package com.campusprint.bridge.data.model

import kotlinx.serialization.Serializable

/**
 * Persisted configuration for the operator terminal.
 */
@Serializable
data class DeviceConfig(
    val serverUrl: String = "ws://10.0.2.2:4000/api/v1/agent/socket",
    val centerId: String = "CTR-CAMPUS-01",
    val secretToken: String = "",
    val autoDownload: Boolean = false,
    val autoPrint: Boolean = false
)

/**
 * Live connection state of the WebSocket client.
 */
sealed interface ConnectionState {
    data class Disconnected(val reason: String? = null) : ConnectionState
    data class Connecting(val url: String) : ConnectionState
    data class Connected(
        val url: String,
        val centerId: String,
        val connectedAt: Long = System.currentTimeMillis()
    ) : ConnectionState
    data class Error(val message: String, val cause: Throwable? = null) : ConnectionState

    val isConnected: Boolean
        get() = this is Connected

    val isConnecting: Boolean
        get() = this is Connecting
}

