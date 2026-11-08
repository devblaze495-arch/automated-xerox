package com.campusprint.bridge.util

import android.os.Bundle
import android.os.CancellationSignal
import android.os.ParcelFileDescriptor
import android.print.PageRange
import android.print.PrintAttributes
import android.print.PrintDocumentAdapter
import android.print.PrintDocumentInfo
import android.util.Log
import java.io.File
import java.io.FileInputStream
import java.io.FileOutputStream
import java.io.IOException

/**
 * Custom PrintDocumentAdapter that bridges a cached PDF file to the Android Print Spooler.
 */
class PdfPrintDocumentAdapter(
    private val pdfFile: File,
    private val documentName: String,
    private val pageCount: Int,
    private val onPrintFinishedCallback: (() -> Unit)? = null
) : PrintDocumentAdapter() {

    override fun onLayout(
        oldAttributes: PrintAttributes?,
        newAttributes: PrintAttributes?,
        cancellationSignal: CancellationSignal?,
        callback: LayoutResultCallback?,
        extras: Bundle?
    ) {
        if (cancellationSignal?.isCanceled == true) {
            callback?.onLayoutCancelled()
            return
        }

        if (!pdfFile.exists()) {
            callback?.onLayoutFailed("PDF file does not exist at ${pdfFile.absolutePath}")
            return
        }

        // Build document metadata
        val info = PrintDocumentInfo.Builder(documentName)
            .setContentType(PrintDocumentInfo.CONTENT_TYPE_DOCUMENT)
            .setPageCount(if (pageCount > 0) pageCount else PrintDocumentInfo.PAGE_COUNT_UNKNOWN)
            .build()

        val changed = newAttributes != oldAttributes
        callback?.onLayoutFinished(info, changed)
    }

    override fun onWrite(
        pages: Array<out PageRange>?,
        destination: ParcelFileDescriptor?,
        cancellationSignal: CancellationSignal?,
        callback: WriteResultCallback?
    ) {
        if (cancellationSignal?.isCanceled == true) {
            callback?.onWriteCancelled()
            return
        }

        if (destination == null) {
            callback?.onWriteFailed("Target file descriptor is null")
            return
        }

        var input: FileInputStream? = null
        var output: FileOutputStream? = null

        try {
            input = FileInputStream(pdfFile)
            output = FileOutputStream(destination.fileDescriptor)

            val buffer = ByteArray(16 * 1024)
            var bytesRead: Int

            while (input.read(buffer).also { bytesRead = it } >= 0) {
                if (cancellationSignal?.isCanceled == true) {
                    callback?.onWriteCancelled()
                    return
                }
                output.write(buffer, 0, bytesRead)
            }

            output.flush()
            callback?.onWriteFinished(arrayOf(PageRange.ALL_PAGES))
            Log.i(TAG, "Successfully streamed PDF bytes to Android Print Spooler")

        } catch (e: IOException) {
            Log.e(TAG, "Error writing PDF to print spooler: ${e.message}", e)
            callback?.onWriteFailed(e.localizedMessage ?: "I/O error during spooling")
        } finally {
            try {
                input?.close()
            } catch (_: Exception) {}
            try {
                output?.close()
            } catch (_: Exception) {}
        }
    }

    override fun onFinish() {
        super.onFinish()
        Log.i(TAG, "Print spooling finished for $documentName")
        onPrintFinishedCallback?.invoke()
    }

    companion object {
        private const val TAG = "PdfPrintAdapter"
    }
}

