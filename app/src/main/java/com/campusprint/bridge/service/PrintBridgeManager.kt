package com.campusprint.bridge.service

import android.app.Activity
import android.content.Context
import android.os.Build
import android.print.PrintAttributes
import android.print.PrintJob
import android.print.PrintManager
import android.util.Log
import com.campusprint.bridge.data.model.ColorMode
import com.campusprint.bridge.data.model.DuplexMode
import com.campusprint.bridge.data.model.PaperSize
import com.campusprint.bridge.data.model.PrintJob as ModelPrintJob
import com.campusprint.bridge.util.PdfPrintDocumentAdapter
import java.io.File

/**
 * Interface for callbacks from the print bridge.
 */
interface PrintBridgeCallback {
    fun onPrintDispatched(jobId: String)
    fun onPrintFinished(jobId: String)
    fun onPrintError(jobId: String, errorMessage: String)
}

/**
 * Service wrapper around Android's native PrintManager and custom PrintDocumentAdapter.
 */
class PrintBridgeManager(private val context: Context) {

    private val printManager: PrintManager? by lazy {
        context.getSystemService(Context.PRINT_SERVICE) as? PrintManager
    }

    /**
     * Dispatches the native Android system print dialog for the given cached PDF file.
     *
     * @param activity Hosting Activity required to present the system print UI dialog.
     * @param job Job specifications (color, duplex, paper size, copies).
     * @param pdfFile Local cached PDF file.
     * @param callback Callback notifying lifecycle transitions.
     */
    fun printDocument(
        activity: Activity,
        job: ModelPrintJob,
        pdfFile: File,
        callback: PrintBridgeCallback? = null
    ): Boolean {
        if (!pdfFile.exists() || pdfFile.length() == 0L) {
            val err = "PDF file missing or empty: ${pdfFile.absolutePath}"
            Log.e(TAG, err)
            callback?.onPrintError(job.orderItemId, err)
            return false
        }

        val manager = printManager ?: (activity.getSystemService(Context.PRINT_SERVICE) as? PrintManager)
        if (manager == null) {
            val err = "PrintManager system service is unavailable on this device"
            Log.e(TAG, err)
            callback?.onPrintError(job.orderItemId, err)
            return false
        }

        try {
            // Build PrintAttributes based on job specs
            val attributesBuilder = PrintAttributes.Builder()

            // 1. Paper Size
            val mediaSize = when (job.paperSize) {
                PaperSize.A3 -> PrintAttributes.MediaSize.ISO_A3
                PaperSize.LETTER -> PrintAttributes.MediaSize.NA_LETTER
                PaperSize.A4 -> PrintAttributes.MediaSize.ISO_A4
            }
            attributesBuilder.setMediaSize(mediaSize)

            // 2. Color Mode
            val colorMode = when (job.colorMode) {
                ColorMode.COLOR -> PrintAttributes.COLOR_MODE_COLOR
                ColorMode.BW -> PrintAttributes.COLOR_MODE_MONOCHROME
            }
            attributesBuilder.setColorMode(colorMode)

            // 3. Duplex Mode (API 23+)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val duplexMode = when (job.duplexMode) {
                    DuplexMode.SIMPLEX -> PrintAttributes.DUPLEX_MODE_NONE
                    DuplexMode.DUPLEX_LONG -> PrintAttributes.DUPLEX_MODE_LONG_EDGE
                    DuplexMode.DUPLEX_SHORT -> PrintAttributes.DUPLEX_MODE_SHORT_EDGE
                }
                attributesBuilder.setDuplexMode(duplexMode)
            }

            // Set minimal zero margins to honor document bounds
            attributesBuilder.setMinMargins(PrintAttributes.Margins.NO_MARGINS)

            val printJobName = "CampusPrint_${job.orderItemId}_${job.documentName}"

            val adapter = PdfPrintDocumentAdapter(
                pdfFile = pdfFile,
                documentName = job.documentName,
                pageCount = job.totalPages,
                onPrintFinishedCallback = {
                    callback?.onPrintFinished(job.orderItemId)
                }
            )

            // Launch the native system print dialog
            val nativePrintJob: PrintJob? = manager.print(
                printJobName,
                adapter,
                attributesBuilder.build()
            )

            if (nativePrintJob != null) {
                Log.i(TAG, "Print job successfully submitted to spooler: ${nativePrintJob.id}")
                callback?.onPrintDispatched(job.orderItemId)
                return true
            } else {
                Log.w(TAG, "Print dialog closed or not queued")
                callback?.onPrintError(job.orderItemId, "Print dialog dismissed")
                return false
            }

        } catch (e: Exception) {
            val err = "Exception while launching system print dialog: ${e.message}"
            Log.e(TAG, err, e)
            callback?.onPrintError(job.orderItemId, err)
            return false
        }
    }

    companion object {
        private const val TAG = "PrintBridgeManager"
    }
}

