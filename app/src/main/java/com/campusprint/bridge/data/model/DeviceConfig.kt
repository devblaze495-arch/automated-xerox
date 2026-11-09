package com.campusprint.bridge.data.model

import kotlinx.serialization.Serializable

/**
 * Standard WebSocket URL endpoints for terminal testing.
 */
object PresetEndpoints {
    /** Default for physical phones connected via USB (requires: `adb reverse tcp:4000 tcp:4000`) */
    const val USB_ADB_REVERSE = "ws://127.0.0.1:4000/api/v1/agent/socket"

    /** Default for Android Studio Emulator loopback to host PC */
    const val EMULATOR_LOOPBACK = "ws://10.0.2.2:4000/api/v1/agent/socket"

    /** Sample for devices on the same Wi-Fi / Local Area Network */
    const val LAN_SAMPLE = "ws://192.168.1.100:4000/api/v1/agent/socket"
}

/**
 * Persisted configuration for the operator terminal.
 */
@Serializable
data class DeviceConfig(
    val serverUrl: String = PresetEndpoints.USB_ADB_REVERSE,
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
