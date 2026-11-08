package com.campusprint.bridge.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Common inbound message wrapper.
 */
@Serializable
data class InboundMessage(
    val type: String,
    val payload: JobDispatchedPayload? = null,
    val message: String? = null,
    val timestamp: Long = System.currentTimeMillis()
)

/**
 * Payload sent by server when a new job is dispatched.
 */
@Serializable
data class JobDispatchedPayload(
    val orderItemId: String,
    val documentName: String,
    val totalPages: Int = 1,
    val colorMode: String = "BW",
    val duplexMode: String = "SIMPLEX",
    val paperSize: String = "A4",
    val copies: Int = 1,
    val downloadUrl: String,
    val createdAt: Long = System.currentTimeMillis()
) {
    fun toPrintJob(): PrintJob {
        val parsedColor = try {
            ColorMode.valueOf(colorMode.uppercase())
        } catch (_: Exception) {
            ColorMode.BW
        }

        val parsedDuplex = try {
            DuplexMode.valueOf(duplexMode.uppercase())
        } catch (_: Exception) {
            DuplexMode.SIMPLEX
        }

        val parsedSize = try {
            PaperSize.valueOf(paperSize.uppercase())
        } catch (_: Exception) {
            PaperSize.A4
        }

        return PrintJob(
            orderItemId = orderItemId,
            documentName = documentName,
            totalPages = totalPages,
            colorMode = parsedColor,
            duplexMode = parsedDuplex,
            paperSize = parsedSize,
            copies = copies.coerceAtLeast(1),
            downloadUrl = downloadUrl,
            createdAt = createdAt,
            status = PrintJobStatus.QUEUED
        )
    }
}

/**
 * Device registration message sent to backend upon WebSocket handshake.
 */
@Serializable
data class DeviceRegisterMessage(
    val type: String = "DEVICE_REGISTER",
    val centerId: String,
    val secretToken: String,
    val deviceModel: String,
    val appVersion: String = "1.0.0",
    val timestamp: Long = System.currentTimeMillis()
)

/**
 * Real-time job status updates reported back to backend.
 */
@Serializable
data class JobStatusUpdateMessage(
    val type: String = "JOB_STATUS_UPDATE",
    val orderItemId: String,
    val status: String,
    val errorMessage: String? = null,
    val timestamp: Long = System.currentTimeMillis()
)

/**
 * Heartbeat ping message to keep connection alive.
 */
@Serializable
data class HeartbeatMessage(
    val type: String = "HEARTBEAT",
    val timestamp: Long = System.currentTimeMillis()
)

