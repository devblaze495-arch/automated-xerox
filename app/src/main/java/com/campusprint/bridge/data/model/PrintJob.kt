package com.campusprint.bridge.data.model

import kotlinx.serialization.Serializable

/**
 * Lifecycle status of an individual print job in the terminal queue.
 */
enum class PrintJobStatus {
    QUEUED,
    DOWNLOADING,
    READY_TO_PRINT,
    PRINTING,
    COMPLETED,
    FAILED;

    val isTerminal: Boolean
        get() = this == COMPLETED || this == FAILED

    val isActive: Boolean
        get() = this == QUEUED || this == DOWNLOADING || this == READY_TO_PRINT || this == PRINTING
}

/**
 * Color mode specified for the document.
 */
enum class ColorMode {
    BW,
    COLOR
}

/**
 * Duplex printing modes.
 */
enum class DuplexMode {
    SIMPLEX,
    DUPLEX_LONG,
    DUPLEX_SHORT
}

/**
 * Target paper size.
 */
enum class PaperSize {
    A4,
    A3,
    LETTER
}

/**
 * Represents a print job dispatched to this terminal.
 */
@Serializable
data class PrintJob(
    val orderItemId: String,
    val documentName: String,
    val totalPages: Int,
    val colorMode: ColorMode = ColorMode.BW,
    val duplexMode: DuplexMode = DuplexMode.SIMPLEX,
    val paperSize: PaperSize = PaperSize.A4,
    val copies: Int = 1,
    val downloadUrl: String,
    val createdAt: Long = System.currentTimeMillis(),
    val status: PrintJobStatus = PrintJobStatus.QUEUED,
    val localFilePath: String? = null,
    val downloadProgress: Float = 0f,
    val errorMessage: String? = null
)

