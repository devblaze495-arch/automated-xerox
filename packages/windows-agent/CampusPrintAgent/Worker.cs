using CampusPrintAgent.Configuration;
using CampusPrintAgent.Networking;
using CampusPrintAgent.Persistence;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;

namespace CampusPrintAgent;

public class Worker : BackgroundService
{
    private readonly AgentWebSocketClient _client;
    private readonly JobDeduplicator _deduplicator;
    private readonly AgentOptions _options;
    private readonly ILogger<Worker> _logger;

    public Worker(
        AgentWebSocketClient client,
        JobDeduplicator deduplicator,
        IOptions<AgentOptions> options,
        ILogger<Worker> logger)
    {
        _client = client;
        _deduplicator = deduplicator;
        _options = options.Value;
        _logger = logger;
    }

    public override async Task StartAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("====================================================================");
        _logger.LogInformation("🚀 Starting CampusPrintAgent Windows Background Print Service");
        _logger.LogInformation("Center ID: {CenterId} | Host: {Host} | Machine: {Machine}",
            _options.CenterId, _options.HostName, Environment.MachineName);
        _logger.LogInformation("WebSocket Server: {Url}", _options.BackendSocketUrl);
        _logger.LogInformation("Hardware Printers Configured: {Count}", _options.Printers.Count);
        foreach (var printer in _options.Printers)
        {
            _logger.LogInformation("  - {Name} on {Port} (Color: {Color}, AutoDuplex: {Duplex}, A3: {A3})",
                printer.Name, printer.Port, printer.Color, printer.AutoDuplex, printer.A3);
        }
        _logger.LogInformation("====================================================================");

        // 1. Initialize SQLite Deduplication Cache
        await _deduplicator.InitializeDatabaseAsync();

        // 2. Ensure Spool directory exists
        Directory.CreateDirectory(_options.TempSpoolDirectory);

        await base.StartAsync(cancellationToken);
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        await _client.RunAsync(stoppingToken);
    }

    public override async Task StopAsync(CancellationToken cancellationToken)
    {
        _logger.LogInformation("🛑 CampusPrintAgent Windows Service stopping gracefully...");
        await base.StopAsync(cancellationToken);
    }
}

