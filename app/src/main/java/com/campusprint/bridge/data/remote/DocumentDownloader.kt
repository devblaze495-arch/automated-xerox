package com.campusprint.bridge.data.remote

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.flow.flowOn
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.io.FileOutputStream
import java.io.IOException
import java.util.concurrent.TimeUnit

/**
 * State emissions during PDF document download.
 */
sealed interface DownloadState {
    data object Idle : DownloadState
    data class Progress(val bytesDownloaded: Long, val totalBytes: Long, val percentage: Float) : DownloadState
    data class Success(val file: File) : DownloadState
    data class Error(val message: String, val throwable: Throwable? = null) : DownloadState
}

/**
 * Coroutine-based document downloader using OkHttp to stream PDFs into app cacheDir.
 */
class DocumentDownloader(
    private val context: Context,
    private val okHttpClient: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .build()
) {

    /**
     * Resolves and ensures the cache sub-directory for print jobs exists.
     */
    private val printCacheDir: File
        get() = File(context.cacheDir, "print_jobs").apply {
            if (!exists()) {
                mkdirs()
            }
        }

    /**
     * Downloads a PDF file from the specified URL and writes it to cacheDir.
     * Emits real-time progress percentages.
     */
    fun downloadPdf(orderItemId: String, downloadUrl: String): Flow<DownloadState> = flow {
        emit(DownloadState.Progress(0, 0, 0f))

        val sanitizedId = orderItemId.replace("[^a-zA-Z0-9_-]".toRegex(), "_")
        val destinationFile = File(printCacheDir, "job_$sanitizedId.pdf")

        // If a valid cached file already exists and is a valid PDF, we can use it
        if (destinationFile.exists() && isValidPdf(destinationFile)) {
            emit(DownloadState.Progress(destinationFile.length(), destinationFile.length(), 1.0f))
            emit(DownloadState.Success(destinationFile))
            return@flow
        }

        val request = Request.Builder()
            .url(downloadUrl)
            .header("Accept", "application/pdf, application/octet-stream, */*")
            .build()

        var outputStream: FileOutputStream? = null

        try {
            val response = okHttpClient.newCall(request).execute()

            if (!response.isSuccessful) {
                emit(DownloadState.Error("Server returned HTTP ${response.code}: ${response.message}"))
                return@flow
            }

            val body = response.body
            if (body == null) {
                emit(DownloadState.Error("Response body is empty"))
                return@flow
            }

            val totalBytes = body.contentLength()
            val inputStream = body.byteStream()
            outputStream = FileOutputStream(destinationFile)

            val buffer = ByteArray(8 * 1024)
            var bytesRead: Int
            var totalBytesRead: Long = 0

            while (inputStream.read(buffer).also { bytesRead = it } != -1) {
                outputStream.write(buffer, 0, bytesRead)
                totalBytesRead += bytesRead

                val progress = if (totalBytes > 0) {
                    (totalBytesRead.toFloat() / totalBytes.toFloat()).coerceIn(0f, 1f)
                } else {
                    -1f // Indeterminate
                }

                emit(DownloadState.Progress(totalBytesRead, totalBytes, progress))
            }

            outputStream.flush()
            outputStream.close()
            outputStream = null

            // Validate PDF header (%PDF-)
            if (!isValidPdf(destinationFile)) {
                destinationFile.delete()
                emit(DownloadState.Error("Downloaded file is not a valid PDF document"))
                return@flow
            }

            emit(DownloadState.Progress(totalBytesRead, totalBytesRead, 1.0f))
            emit(DownloadState.Success(destinationFile))

        } catch (e: IOException) {
            destinationFile.delete()
            emit(DownloadState.Error("Network failure while downloading: ${e.localizedMessage ?: "Unknown error"}", e))
        } catch (e: Exception) {
            destinationFile.delete()
            emit(DownloadState.Error("Error during file download: ${e.localizedMessage ?: "Unknown error"}", e))
        } finally {
            try {
                outputStream?.close()
            } catch (_: Exception) {}
        }
    }.flowOn(Dispatchers.IO)

    /**
     * Checks if the target file has the PDF magic header `%PDF`.
     */
    private fun isValidPdf(file: File): Boolean {
        if (!file.exists() || file.length() < 4) return false
        return try {
            file.inputStream().use { stream ->
                val header = ByteArray(4)
                val read = stream.read(header)
                read == 4 && header[0] == '%'.code.toByte() &&
                        header[1] == 'P'.code.toByte() &&
                        header[2] == 'D'.code.toByte() &&
                        header[3] == 'F'.code.toByte()
            }
        } catch (_: Exception) {
            false
        }
    }

    /**
     * Generates a sample mock PDF in the cache directory for offline terminal operator testing.
     */
    fun createMockPdfFile(orderItemId: String, documentTitle: String): File {
        val sanitizedId = orderItemId.replace("[^a-zA-Z0-9_-]".toRegex(), "_")
        val file = File(printCacheDir, "job_$sanitizedId.pdf")

        // Minimal valid single-page PDF bytes
        val minimalPdfContent = """
            %PDF-1.4
            1 0 obj
            << /Type /Catalog /Pages 2 0 R >>
            endobj
            2 0 obj
            << /Type /Pages /Kids [3 0 R] /Count 1 >>
            endobj
            3 0 obj
            << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>
            endobj
            4 0 obj
            << /Length 110 >>
            stream
            BT
            /F1 24 Tf
            50 780 Td
            (Campus Print Operator Test: $documentTitle) Tj
            ET
            endstream
            endobj
            5 0 obj
            << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>
            endobj
            xref
            0 6
            0000000000 65535 f 
            0000000009 00000 n 
            0000000058 00000 n 
            0000000115 00000 n 
            0000000244 00000 n 
            0000000405 00000 n 
            trailer
            << /Size 6 /Root 1 0 R >>
            startxref
            490
            %%EOF
        """.trimIndent()

        file.writeText(minimalPdfContent)
        return file
    }
}

