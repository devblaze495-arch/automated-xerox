package com.campusprint.bridge.service

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
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
import java.lang.ref.WeakReference

/**
 * Interface for callbacks from the print bridge.
 */
interface PrintBridgeCallback {
    fun onPrintDispatched(jobId: String)
    fun onPrintFinished(jobId: String)
    fun onPrintError(jobId: String, errorMessage: String)
}

/**
 * Extension function unwrapping Context to find the hosting Activity.
 * Needed because Compose LocalContext or themed contexts can wrap the Activity.
 */
tailrec fun Context.findActivity(): Activity? = when (this) {
    is Activity -> this
    is ContextWrapper -> baseContext.findActivity()
    else -> null
}

/**
 * Service wrapper around Android's native PrintManager and custom PrintDocumentAdapter.
 *
 * IMPORTANT:
 * Android's PrintManager REQUIRES an Activity context when calling print(). Calling print()
 * on a PrintManager obtained from ApplicationContext throws:
 * `java.lang.IllegalStateException: Can print only from an activity`
 *
 * This class tracks the active Activity via attachActivity()/detachActivity() and resolves
 * PrintManager strictly from an active Activity instance.
 */
class PrintBridgeManager(private val context: Context) {

    private var activeActivityRef: WeakReference<Activity>? = null

    /**
     * Attaches the currently foregrounded Activity to this manager so system print dialogs
     * can be presented even when triggered from background flows or view models.
     */
    fun attachActivity(activity: Activity) {
        Log.d(TAG, "Attaching active activity: ${activity.javaClass.simpleName}")
        activeActivityRef = WeakReference(activity)
    }

    /**
     * Detaches the Activity when it is destroyed or paused.
     */
    fun detachActivity(activity: Activity? = null) {
        val current = activeActivityRef?.get()
        if (activity == null || current == activity) {
            Log.d(TAG, "Detaching activity reference")
            activeActivityRef?.clear()
            activeActivityRef = null
        }
    }

    /**
     * Returns the currently attached active Activity, or null if unavailable or finishing.
     */
    fun getActiveActivity(): Activity? {
        val activity = activeActivityRef?.get()
        return if (activity != null && !activity.isFinishing && !activity.isDestroyedCompat()) {
            activity
        } else {
            null
        }
    }

    private fun Activity.isDestroyedCompat(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN_MR1) {
            isDestroyed
        } else {
            false
        }
    }

    /**
     * Dispatches the native Android system print dialog for the given cached PDF file.
     * Resolves the Activity from the parameter, context unwrapping, or the active attached Activity reference.
     *
     * @param activity Optional hosting Activity.
     * @param context Optional Context (unwrapped via findActivity).
     * @param job Job specifications (color, duplex, paper size, copies).
     * @param pdfFile Local cached PDF file.
     * @param callback Callback notifying lifecycle transitions.
     */
    fun printDocument(
        activity: Activity? = null,
        context: Context? = null,
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

        // Resolve valid Activity instance: parameter -> context unwrap -> attached activity
        val targetActivity = activity
            ?: context?.findActivity()
            ?: getActiveActivity()

        if (targetActivity == null || targetActivity.isFinishing || targetActivity.isDestroyedCompat()) {
            val err = "Can print only from an activity: No active Activity available to present print dialog"
            Log.e(TAG, err)
            callback?.onPrintError(job.orderItemId, err)
            return false
        }

        // CRITICAL: Obtain PrintManager directly from the Activity context!
        // android.print.PrintManager.print() checks `if (!(mContext instanceof Activity))` and throws
        // IllegalStateException if obtained from ApplicationContext.
        val manager = targetActivity.getSystemService(Context.PRINT_SERVICE) as? PrintManager
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

            // Launch the native system print dialog from the UI thread of the target activity
            targetActivity.runOnUiThread {
                try {
                    val nativePrintJob: PrintJob? = manager.print(
                        printJobName,
                        adapter,
                        attributesBuilder.build()
                    )

                    if (nativePrintJob != null) {
                        Log.i(TAG, "Print job successfully submitted to spooler: ${nativePrintJob.id}")
                        callback?.onPrintDispatched(job.orderItemId)
                    } else {
                        Log.w(TAG, "Print dialog closed or not queued")
                        callback?.onPrintError(job.orderItemId, "Print dialog dismissed")
                    }
                } catch (e: Exception) {
                    val err = "Exception launching print dialog on UI thread: ${e.message}"
                    Log.e(TAG, err, e)
                    callback?.onPrintError(job.orderItemId, err)
                }
            }

            return true

        } catch (e: Exception) {
            val err = "Exception while preparing system print dialog: ${e.message}"
            Log.e(TAG, err, e)
            callback?.onPrintError(job.orderItemId, err)
            return false
        }
    }

    companion object {
        private const val TAG = "PrintBridgeManager"
    }
}
