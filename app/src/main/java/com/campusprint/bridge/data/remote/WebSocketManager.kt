package com.campusprint.bridge.data.remote

import android.os.Build
import android.util.Log
import com.campusprint.bridge.data.model.ConnectionState
import com.campusprint.bridge.data.model.DeviceConfig
import com.campusprint.bridge.data.model.DeviceRegisterMessage
import com.campusprint.bridge.data.model.HeartbeatMessage
import com.campusprint.bridge.data.model.InboundMessage
import com.campusprint.bridge.data.model.JobStatusUpdateMessage
import com.campusprint.bridge.data.model.PrintJob
import com.campusprint.bridge.data.model.PrintJobStatus
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancelChildren
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Persistent OkHttp WebSocket manager handling connection lifecycle,
 * registration handshakes, inbound JOB_DISPATCHED events, and outbound updates.
 */
class WebSocketManager(
    private val client: OkHttpClient = OkHttpClient.Builder()
        .pingInterval(15, TimeUnit.SECONDS)
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(0, TimeUnit.MILLISECONDS) // Disable timeout for persistent WebSocket
        .build()
) {

    private val json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        encodeDefaults = true
    }

    private val managerScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val _connectionState = MutableStateFlow<ConnectionState>(ConnectionState.Disconnected())
    val connectionState: StateFlow<ConnectionState> = _connectionState.asStateFlow()

    private val _incomingJobs = MutableSharedFlow<PrintJob>(extraBufferCapacity = 64)
    val incomingJobs: SharedFlow<PrintJob> = _incomingJobs.asSharedFlow()

    private var activeWebSocket: WebSocket? = null
    private var currentConfig: DeviceConfig? = null
    private var reconnectJob: Job? = null
    private var heartbeatJob: Job? = null
    private val shouldReconnect = AtomicBoolean(false)
    private var retryAttempt = 0

    /**
     * Connect to the server WebSocket using the provided configuration.
     */
    fun connect(config: DeviceConfig) {
        currentConfig = config
        shouldReconnect.set(true)
        retryAttempt = 0
        reconnectJob?.cancel()
        initiateConnection(config)
    }

    /**
     * Disconnect gracefully from the server.
     */
    fun disconnect(reason: String = "User requested disconnect") {
        shouldReconnect.set(false)
        reconnectJob?.cancel()
        heartbeatJob?.cancel()

        activeWebSocket?.close(1000, reason)
        activeWebSocket = null
        _connectionState.value = ConnectionState.Disconnected(reason)
        Log.i(TAG, "Disconnected: $reason")
    }

    private fun initiateConnection(config: DeviceConfig) {
        val trimmedUrl = config.serverUrl.trim()
        if (!trimmedUrl.startsWith("ws://") && !trimmedUrl.startsWith("wss://")) {
            _connectionState.value = ConnectionState.Error("Invalid protocol: URL must start with ws:// or wss://")
            return
        }

        _connectionState.value = ConnectionState.Connecting(trimmedUrl)
        Log.i(TAG, "Connecting to WebSocket at $trimmedUrl...")

        val request = Request.Builder()
            .url(trimmedUrl)
            .addHeader("X-Center-ID", config.centerId)
            .addHeader("X-Agent-Secret", config.secretToken)
            .build()

        activeWebSocket = client.newWebSocket(request, createListener(config))
    }

    private fun createListener(config: DeviceConfig): WebSocketListener {
        return object : WebSocketListener() {
            override fun onOpen(webSocket: WebSocket, response: Response) {
                Log.i(TAG, "WebSocket Connection Established")
                retryAttempt = 0
                _connectionState.value = ConnectionState.Connected(
                    url = config.serverUrl,
                    centerId = config.centerId
                )

                // Send immediate registration payload
                sendDeviceRegistration(config)

                // Start periodic heartbeat
                startHeartbeat()
            }

            override fun onMessage(webSocket: WebSocket, text: String) {
                Log.d(TAG, "Inbound WebSocket message: $text")
                handleInboundMessage(text)
            }

            override fun onClosing(webSocket: WebSocket, code: Int, reason: String) {
                Log.w(TAG, "WebSocket closing code=$code, reason=$reason")
                webSocket.close(1000, null)
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                Log.w(TAG, "WebSocket closed code=$code, reason=$reason")
                heartbeatJob?.cancel()
                if (shouldReconnect.get()) {
                    scheduleReconnect()
                } else {
                    _connectionState.value = ConnectionState.Disconnected("Connection closed ($code: $reason)")
                }
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                Log.e(TAG, "WebSocket failure: ${t.message}", t)
                heartbeatJob?.cancel()
                _connectionState.value = ConnectionState.Error(
                    message = t.localizedMessage ?: "WebSocket transport failure",
                    cause = t
                )
                if (shouldReconnect.get()) {
                    scheduleReconnect()
                }
            }
        }
    }

    private fun handleInboundMessage(rawJson: String) {
        try {
            val inbound = json.decodeFromString<InboundMessage>(rawJson)
            when (inbound.type.uppercase()) {
                "JOB_DISPATCHED" -> {
                    inbound.payload?.let { payload ->
                        val printJob = payload.toPrintJob()
                        Log.i(TAG, "Received new job dispatch: ${printJob.orderItemId} - ${printJob.documentName}")
                        managerScope.launch {
                            _incomingJobs.emit(printJob)
                        }
                    } ?: run {
                        Log.w(TAG, "Received JOB_DISPATCHED but payload was null: $rawJson")
                    }
                }
                "REGISTER_ACK", "CONNECTED" -> {
                    Log.i(TAG, "Device registration confirmed by server")
                }
                "PING" -> {
                    sendHeartbeat()
                }
                "ERROR" -> {
                    Log.e(TAG, "Server reported error: ${inbound.message}")
                }
                else -> {
                    Log.d(TAG, "Unhandled message type: ${inbound.type}")
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to parse inbound JSON message: ${e.message}", e)
        }
    }

    /**
     * Sends the initial registration message with terminal specs.
     */
    private fun sendDeviceRegistration(config: DeviceConfig) {
        val registerMessage = DeviceRegisterMessage(
            centerId = config.centerId,
            secretToken = config.secretToken,
            deviceModel = "${Build.MANUFACTURER} ${Build.MODEL} (Android ${Build.VERSION.RELEASE}, API ${Build.VERSION.SDK_INT})",
            appVersion = "1.0.0"
        )
        val payloadStr = json.encodeToString(registerMessage)
        sendMessage(payloadStr)
        Log.i(TAG, "Sent DEVICE_REGISTER: $payloadStr")
    }

    /**
     * Reports job status transitions (PRINTING, COMPLETED, FAILED) back to server.
     */
    fun sendJobStatusUpdate(orderItemId: String, status: PrintJobStatus, errorMessage: String? = null): Boolean {
        val message = JobStatusUpdateMessage(
            orderItemId = orderItemId,
            status = status.name,
            errorMessage = errorMessage
        )
        val payloadStr = json.encodeToString(message)
        val sent = sendMessage(payloadStr)
        Log.i(TAG, "Sent JOB_STATUS_UPDATE: $payloadStr (sent=$sent)")
        return sent
    }

    /**
     * Sends raw text through active WebSocket.
     */
    fun sendMessage(text: String): Boolean {
        val ws = activeWebSocket
        return if (ws != null && _connectionState.value is ConnectionState.Connected) {
            ws.send(text)
        } else {
            Log.w(TAG, "Cannot send message: WebSocket is not connected")
            false
        }
    }

    private fun startHeartbeat() {
        heartbeatJob?.cancel()
        heartbeatJob = managerScope.launch {
            while (isActive) {
                delay(30_000) // Heartbeat every 30 seconds
                if (_connectionState.value is ConnectionState.Connected) {
                    sendHeartbeat()
                }
            }
        }
    }

    private fun sendHeartbeat() {
        val msg = HeartbeatMessage()
        val text = json.encodeToString(msg)
        sendMessage(text)
    }

    private fun scheduleReconnect() {
        if (!shouldReconnect.get()) return
        val config = currentConfig ?: return

        retryAttempt++
        // Exponential backoff: 2s, 4s, 8s, 16s, capped at 30s
        val backoffSeconds = (1L shl retryAttempt.coerceAtMost(5)).coerceAtMost(30L)

        _connectionState.value = ConnectionState.Connecting(
            "${config.serverUrl} (reconnecting in ${backoffSeconds}s, attempt #$retryAttempt)"
        )
        Log.i(TAG, "Scheduling reconnect attempt #$retryAttempt in ${backoffSeconds}s...")

        reconnectJob?.cancel()
        reconnectJob = managerScope.launch {
            delay(backoffSeconds * 1000)
            if (shouldReconnect.get()) {
                initiateConnection(config)
            }
        }
    }

    /**
     * Emits a simulated job dispatch locally without needing an external WebSocket server.
     * Essential for local operator testing.
     */
    fun emitSimulatedJob(job: PrintJob) {
        managerScope.launch {
            _incomingJobs.emit(job)
        }
    }

    fun release() {
        disconnect("Manager released")
        managerScope.coroutineContext.cancelChildren()
    }

    companion object {
        private const val TAG = "PrintBridgeWS"
    }
}

