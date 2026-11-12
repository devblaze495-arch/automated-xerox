using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;
using CampusPrintAgent.Configuration;
using CampusPrintAgent.Persistence;
using CampusPrintAgent.Spooler;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace CampusPrintAgent.Networking;

public class AgentWebSocketClient
{
    private readonly AgentOptions _options;
    private readonly DocumentDownloader _downloader;
    private readonly WindowsPrintDispatcher _dispatcher;
    private readonly JobDeduplicator _deduplicator;
    private readonly SpoolerMonitor _spoolerMonitor;
    private readonly ILogger<AgentWebSocketClient> _logger;

    private ClientWebSocket? _webSocket;
    private readonly SemaphoreSlim _sendLock = new(1, 1);
    private volatile bool _isSpoolerPaused = false;
    private readonly ConcurrentQueue<DispatchedJobPayload> _heldJobs = new();

    public bool IsSpoolerPaused => _isSpoolerPaused;

    public AgentWebSocketClient(
        IOptions<AgentOptions> options,
        DocumentDownloader downloader,
        WindowsPrintDispatcher dispatcher,
        JobDeduplicator deduplicator,
        SpoolerMonitor spoolerMonitor,
        ILogger<AgentWebSocketClient> logger)
    {
        _options = options.Value;
        _downloader = downloader;
        _dispatcher = dispatcher;
        _deduplicator = deduplicator;
        _spoolerMonitor = spoolerMonitor;
        _logger = logger;
    }

    public async Task RunAsync(CancellationToken cancellationToken)
    {
        var backoffSeconds = 2;
        const int maxBackoff = 30;

        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                _logger.LogInformation("Connecting outbound WebSocket to Fastify backend: {Url} (Center: {Center})",
                    _options.BackendSocketUrl, _options.CenterId);

                _webSocket = new ClientWebSocket();
                _webSocket.Options.SetRequestHeader("x-center-id", _options.CenterId);
                _webSocket.Options.SetRequestHeader("x-agent-secret", _options.AgentSecret);
                _webSocket.Options.KeepAliveInterval = TimeSpan.FromSeconds(20);

                var uri = new Uri(_options.BackendSocketUrl);
                await _webSocket.ConnectAsync(uri, cancellationToken);

                _logger.LogInformation("✅ Connected to Campus Print WebSocket Gateway. Sending device registration...");
                backoffSeconds = 2; // Reset backoff on successful connection

                // Send DEVICE_REGISTER
                await SendDeviceRegistrationAsync(cancellationToken);

                // Send initial PRINTER_TELEMETRY immediately upon connect
                await SendPrinterTelemetryAsync(cancellationToken);

                // Run Heartbeat, Telemetry and Receive loops concurrently
                using var linkedCts = CancellationTokenSource.CreateLinkedTokenSource(cancellationToken);
                var heartbeatTask = RunHeartbeatLoopAsync(linkedCts.Token);
                var telemetryTask = RunPrinterTelemetryLoopAsync(linkedCts.Token);
                var receiveTask = RunReceiveLoopAsync(linkedCts.Token);

                var completedTask = await Task.WhenAny(heartbeatTask, telemetryTask, receiveTask);
                linkedCts.Cancel();

                await completedTask; // observe exceptions if any
            }
            catch (OperationCanceledException) when (cancellationToken.IsCancellationRequested)
            {
                _logger.LogInformation("WebSocket client shutting down due to service stop.");
                break;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "WebSocket connection failed or dropped. Reconnecting in {Seconds}s...", backoffSeconds);
            }
            finally
            {
                CleanupSocket();
            }

            if (!cancellationToken.IsCancellationRequested)
            {
                await Task.Delay(TimeSpan.FromSeconds(backoffSeconds), cancellationToken);
                backoffSeconds = Math.Min(backoffSeconds * 2, maxBackoff);
            }
        }
    }

    private async Task SendDeviceRegistrationAsync(CancellationToken cancellationToken)
    {
        var message = new DeviceRegisterMessage
        {
            CenterId = _options.CenterId,
            AgentSecret = _options.AgentSecret,
            Platform = "WINDOWS_AGENT_NET8",
            HostName = _options.HostName,
            DeviceModel = $"Windows {Environment.OSVersion.Version.Major} x64 (.NET 8 Background Service)",
            AppVersion = "1.0.0",
            Printers = _options.Printers.Select(p => new PrinterRegistrationDto
            {
                Name = p.Name,
                Port = p.Port,
                Color = p.Color,
                AutoDuplex = p.AutoDuplex,
                ManualDuplex = p.ManualDuplex,
                A3 = p.A3
            }).ToList()
        };

        await SendJsonAsync(message, cancellationToken);
        _logger.LogInformation("Dispatched DEVICE_REGISTER message with {Count} local Canon hardware configurations.", message.Printers.Count);
    }

    private async Task RunHeartbeatLoopAsync(CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested && _webSocket?.State == WebSocketState.Open)
        {
            await Task.Delay(TimeSpan.FromSeconds(30), cancellationToken);

            try
            {
                var heartbeat = new HeartbeatMessage();
                await SendJsonAsync(heartbeat, cancellationToken);
                _logger.LogDebug("Heartbeat ping dispatched to Fastify backend.");
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to send heartbeat ping.");
                break;
            }
        }
    }

    private async Task SendPrinterTelemetryAsync(CancellationToken cancellationToken)
    {
        try
        {
            var telemetryList = _spoolerMonitor.CollectAllTelemetry(_options.Printers);
            var message = new PrinterTelemetryMessage
            {
                CenterId = _options.CenterId,
                Printers = telemetryList
            };
            await SendJsonAsync(message, cancellationToken);
            _logger.LogDebug("Dispatched live PRINTER_TELEMETRY update for {Count} printer(s).", telemetryList.Count);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to dispatch printer telemetry update.");
        }
    }

    private async Task RunPrinterTelemetryLoopAsync(CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested && _webSocket?.State == WebSocketState.Open)
        {
            await Task.Delay(TimeSpan.FromSeconds(10), cancellationToken);

            if (_webSocket?.State == WebSocketState.Open)
            {
                await SendPrinterTelemetryAsync(cancellationToken);
            }
        }
    }

    private async Task RunReceiveLoopAsync(CancellationToken cancellationToken)
    {
        var buffer = new byte[65536];
        var ms = new MemoryStream();

        while (!cancellationToken.IsCancellationRequested && _webSocket?.State == WebSocketState.Open)
        {
            ms.SetLength(0);
            WebSocketReceiveResult result;

            do
            {
                result = await _webSocket.ReceiveAsync(new ArraySegment<byte>(buffer), cancellationToken);

                if (result.MessageType == WebSocketMessageType.Close)
                {
                    _logger.LogWarning("Remote server closed WebSocket: {Desc}", result.CloseStatusDescription);
                    return;
                }

                ms.Write(buffer, 0, result.Count);
            } while (!result.EndOfMessage);

            var jsonString = Encoding.UTF8.GetString(ms.ToArray());
            await ProcessInboundMessageAsync(jsonString, cancellationToken);
        }
    }

    private async Task ProcessInboundMessageAsync(string jsonString, CancellationToken cancellationToken)
    {
        try
        {
            var serverMessage = JsonSerializer.Deserialize<ServerMessage>(jsonString);
            if (serverMessage == null) return;

            switch (serverMessage.Type)
            {
                case "REGISTER_ACK":
                    _logger.LogInformation("✅ Gateway Handshake Acknowledged: {Message}", serverMessage.Message);
                    if (serverMessage.IsPaused.HasValue)
                    {
                        _isSpoolerPaused = serverMessage.IsPaused.Value;
                        if (_isSpoolerPaused)
                        {
                            _logger.LogWarning("Spooler paused by operator for walk-in priority. Holding digital queue.");
                        }
                    }
                    break;

                case "SPOOLER_STATE":
                    var targetPaused = serverMessage.IsPaused ?? false;
                    _isSpoolerPaused = targetPaused;
                    if (_isSpoolerPaused)
                    {
                        _logger.LogWarning("Spooler paused by operator for walk-in priority. Holding digital queue.");
                    }
                    else
                    {
                        _logger.LogInformation("▶️ Spooler resumed by operator. Processing digital print queue ({Count} held jobs)...", _heldJobs.Count);
                        _ = Task.Run(() => FlushHeldJobsAsync(cancellationToken), cancellationToken);
                    }
                    break;

                case "HEARTBEAT_ACK":
                    _logger.LogDebug("Gateway Heartbeat ACK received.");
                    break;

                case "JOB_DISPATCHED":
                    if (serverMessage.Payload != null)
                    {
                        if (_isSpoolerPaused)
                        {
                            _logger.LogWarning("Spooler paused by operator for walk-in priority. Holding digital queue. Held job: OrderItem [{OrderItemId}] ({DocumentName})",
                                serverMessage.Payload.OrderItemId, serverMessage.Payload.DocumentName);
                            _heldJobs.Enqueue(serverMessage.Payload);
                        }
                        else
                        {
                            // Handle job in background task so socket read loop doesn't stall
                            _ = Task.Run(() => HandleJobDispatchedAsync(serverMessage.Payload, cancellationToken), cancellationToken);
                        }
                    }
                    break;

                case "ERROR":
                    _logger.LogError("Server reported error: {Message}", serverMessage.Message);
                    break;

                default:
                    _logger.LogDebug("Received unhandled message type: {Type}", serverMessage.Type);
                    break;
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to parse inbound JSON message: {Raw}", jsonString);
        }
    }

    private async Task FlushHeldJobsAsync(CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested && !_isSpoolerPaused && _heldJobs.TryDequeue(out var job))
        {
            _logger.LogInformation("🚀 Flushing held job to hardware spooler: OrderItem [{OrderItemId}] ({DocumentName})", job.OrderItemId, job.DocumentName);
            await HandleJobDispatchedAsync(job, cancellationToken);
        }
    }

    private async Task HandleJobDispatchedAsync(DispatchedJobPayload job, CancellationToken cancellationToken)
    {
        if (_isSpoolerPaused)
        {
            _logger.LogWarning("Spooler paused by operator for walk-in priority. Holding digital queue. Held job: OrderItem [{OrderItemId}] ({DocumentName}).",
                job.OrderItemId, job.DocumentName);
            _heldJobs.Enqueue(job);
            return;
        }

        _logger.LogInformation("📥 [JOB_DISPATCHED] Received OrderItem [{OrderItemId}] ({DocumentName}, {Pages} pages, {Copies} copies, {Color}, {Duplex})",
            job.OrderItemId, job.DocumentName, job.TotalPages, job.Copies, job.ColorMode, job.DuplexMode);

        // 1. Deduplication Check via SQLite
        if (await _deduplicator.IsJobAlreadyProcessedAsync(job.OrderItemId))
        {
            _logger.LogWarning("Duplicate job received for OrderItem [{OrderItemId}]. Already processed. Acknowledging COMPLETED.", job.OrderItemId);
            await SendJobStatusUpdateAsync(job.OrderItemId, "COMPLETED", null, cancellationToken);
            return;
        }

        // 2. Notify backend: Status -> PRINTING
        await SendJobStatusUpdateAsync(job.OrderItemId, "PRINTING", null, cancellationToken);
        await _deduplicator.RecordJobStartedAsync(job.OrderItemId, job.DocumentName, job.TargetPrinter?.Name ?? "AUTO");

        string? downloadedPdfPath = null;
        try
        {
            // 3. Download and verify PDF header
            downloadedPdfPath = await _downloader.DownloadAndVerifyPdfAsync(
                job.DownloadUrl,
                _options.TempSpoolDirectory,
                job.OrderItemId,
                cancellationToken);

            // 4. Dispatch to Windows Spooler
            if (_isSpoolerPaused)
            {
                _logger.LogWarning("Spooler paused by operator for walk-in priority. Holding digital queue before winspool.drv dispatch for OrderItem [{OrderItemId}].", job.OrderItemId);
                _heldJobs.Enqueue(job);
                return;
            }

            await _dispatcher.DispatchJobAsync(job, downloadedPdfPath, _options.Printers, cancellationToken);

            // 5. Update status: COMPLETED
            await _deduplicator.RecordJobCompletedAsync(job.OrderItemId);
            await SendJobStatusUpdateAsync(job.OrderItemId, "COMPLETED", null, cancellationToken);

            _logger.LogInformation("🎉 OrderItem [{OrderItemId}] completed and spooled successfully!", job.OrderItemId);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ Print job failed for OrderItem [{OrderItemId}]: {Message}", job.OrderItemId, ex.Message);
            await _deduplicator.RecordJobFailedAsync(job.OrderItemId, ex.Message);
            await SendJobStatusUpdateAsync(job.OrderItemId, "FAILED", ex.Message, cancellationToken);
        }
    }

    public async Task SendJobStatusUpdateAsync(string orderItemId, string status, string? errorMessage, CancellationToken cancellationToken)
    {
        var update = new JobStatusUpdateMessage
        {
            OrderItemId = orderItemId,
            Status = status,
            ErrorMessage = errorMessage
        };

        await SendJsonAsync(update, cancellationToken);
        _logger.LogInformation("📤 Sent JOB_STATUS_UPDATE: OrderItem [{OrderItemId}] -> {Status} {Err}",
            orderItemId, status, errorMessage != null ? $"({errorMessage})" : string.Empty);
    }

    private async Task SendJsonAsync<T>(T obj, CancellationToken cancellationToken)
    {
        if (_webSocket?.State != WebSocketState.Open) return;

        var json = JsonSerializer.Serialize(obj);
        var bytes = Encoding.UTF8.GetBytes(json);

        await _sendLock.WaitAsync(cancellationToken);
        try
        {
            if (_webSocket?.State == WebSocketState.Open)
            {
                await _webSocket.SendAsync(new ArraySegment<byte>(bytes), WebSocketMessageType.Text, true, cancellationToken);
            }
        }
        finally
        {
            _sendLock.Release();
        }
    }

    private void CleanupSocket()
    {
        try
        {
            _webSocket?.Dispose();
        }
        catch { }
        finally
        {
            _webSocket = null;
        }
    }
}

