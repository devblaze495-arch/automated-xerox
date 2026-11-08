package com.campusprint.bridge.ui.screens.dashboard

import android.app.Activity
import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.campusprint.bridge.CampusPrintApp
import com.campusprint.bridge.data.local.PreferencesRepository
import com.campusprint.bridge.data.model.ColorMode
import com.campusprint.bridge.data.model.ConnectionState
import com.campusprint.bridge.data.model.DuplexMode
import com.campusprint.bridge.data.model.PaperSize
import com.campusprint.bridge.data.model.PrintJob
import com.campusprint.bridge.data.model.PrintJobStatus
import com.campusprint.bridge.data.remote.DocumentDownloader
import com.campusprint.bridge.data.remote.DownloadState
import com.campusprint.bridge.data.remote.WebSocketManager
import com.campusprint.bridge.service.PrintBridgeCallback
import com.campusprint.bridge.service.PrintBridgeManager
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import java.io.File
import java.util.UUID

enum class JobFilter {
    ALL,
    ACTIVE,
    COMPLETED,
    FAILED
}

data class DashboardUiState(
    val jobs: List<PrintJob> = emptyList(),
    val currentFilter: JobFilter = JobFilter.ALL,
    val connectionState: ConnectionState = ConnectionState.Disconnected(),
    val userMessage: String? = null
) {
    val filteredJobs: List<PrintJob>
        get() = when (currentFilter) {
            JobFilter.ALL -> jobs
            JobFilter.ACTIVE -> jobs.filter { it.status.isActive }
            JobFilter.COMPLETED -> jobs.filter { it.status == PrintJobStatus.COMPLETED }
            JobFilter.FAILED -> jobs.filter { it.status == PrintJobStatus.FAILED }
        }

    val queuedCount: Int
        get() = jobs.count { it.status == PrintJobStatus.QUEUED }

    val printingCount: Int
        get() = jobs.count { it.status == PrintJobStatus.PRINTING || it.status == PrintJobStatus.DOWNLOADING }

    val completedCount: Int
        get() = jobs.count { it.status == PrintJobStatus.COMPLETED }
}

class DashboardViewModel(application: Application) : AndroidViewModel(application) {

    private val app = application as CampusPrintApp
    private val repository: PreferencesRepository = app.container.preferencesRepository
    private val wsManager: WebSocketManager = app.container.webSocketManager
    private val downloader: DocumentDownloader = app.container.documentDownloader
    private val printBridgeManager: PrintBridgeManager = app.container.printBridgeManager

    private val _uiState = MutableStateFlow(DashboardUiState())
    val uiState: StateFlow<DashboardUiState> = _uiState.asStateFlow()

    init {
        // Observe incoming dispatched print jobs from WebSocket
        viewModelScope.launch {
            wsManager.incomingJobs.collect { newJob ->
                repository.incrementReceivedJobs()
                _uiState.value = _uiState.value.copy(
                    jobs = listOf(newJob) + _uiState.value.jobs
                )

                // Check auto-download setting
                val config = repository.loadConfig()
                if (config.autoDownload) {
                    downloadPdfOnly(newJob)
                }
            }
        }

        // Observe connection state
        viewModelScope.launch {
            wsManager.connectionState.collectLatest { state ->
                _uiState.value = _uiState.value.copy(connectionState = state)
            }
        }
    }

    fun setFilter(filter: JobFilter) {
        _uiState.value = _uiState.value.copy(currentFilter = filter)
    }

    fun clearUserMessage() {
        _uiState.value = _uiState.value.copy(userMessage = null)
    }

    /**
     * Downloads the PDF file and immediately launches the native Android Print Dialog.
     */
    fun processAndPrintJob(activity: Activity, job: PrintJob) {
        viewModelScope.launch {
            // Check if file is already downloaded and valid
            if (job.localFilePath != null) {
                val cachedFile = File(job.localFilePath)
                if (cachedFile.exists() && cachedFile.length() > 0) {
                    launchSystemPrintDialog(activity, job, cachedFile)
                    return@launch
                }
            }

            // Download file
            updateJob(job.copy(status = PrintJobStatus.DOWNLOADING, downloadProgress = 0f, errorMessage = null))

            downloader.downloadPdf(job.orderItemId, job.downloadUrl).collect { state ->
                when (state) {
                    is DownloadState.Progress -> {
                        updateJob(job.copy(
                            status = PrintJobStatus.DOWNLOADING,
                            downloadProgress = state.percentage
                        ))
                    }
                    is DownloadState.Success -> {
                        val downloadedJob = job.copy(
                            status = PrintJobStatus.READY_TO_PRINT,
                            localFilePath = state.file.absolutePath,
                            downloadProgress = 1.0f
                        )
                        updateJob(downloadedJob)

                        // Launch Print Dialog on UI Thread
                        launchSystemPrintDialog(activity, downloadedJob, state.file)
                    }
                    is DownloadState.Error -> {
                        val failedJob = job.copy(
                            status = PrintJobStatus.FAILED,
                            errorMessage = state.message
                        )
                        updateJob(failedJob)
                        wsManager.sendJobStatusUpdate(job.orderItemId, PrintJobStatus.FAILED, state.message)
                        _uiState.value = _uiState.value.copy(userMessage = "Download failed: ${state.message}")
                    }
                    DownloadState.Idle -> {}
                }
            }
        }
    }

    private fun downloadPdfOnly(job: PrintJob) {
        viewModelScope.launch {
            updateJob(job.copy(status = PrintJobStatus.DOWNLOADING))
            downloader.downloadPdf(job.orderItemId, job.downloadUrl).collect { state ->
                when (state) {
                    is DownloadState.Progress -> {
                        updateJob(job.copy(downloadProgress = state.percentage))
                    }
                    is DownloadState.Success -> {
                        updateJob(job.copy(
                            status = PrintJobStatus.READY_TO_PRINT,
                            localFilePath = state.file.absolutePath,
                            downloadProgress = 1.0f
                        ))
                    }
                    is DownloadState.Error -> {
                        updateJob(job.copy(
                            status = PrintJobStatus.FAILED,
                            errorMessage = state.message
                        ))
                    }
                    DownloadState.Idle -> {}
                }
            }
        }
    }

    private fun launchSystemPrintDialog(activity: Activity, job: PrintJob, pdfFile: File) {
        updateJob(job.copy(status = PrintJobStatus.PRINTING))
        wsManager.sendJobStatusUpdate(job.orderItemId, PrintJobStatus.PRINTING)

        val success = printBridgeManager.printDocument(
            activity = activity,
            job = job,
            pdfFile = pdfFile,
            callback = object : PrintBridgeCallback {
                override fun onPrintDispatched(jobId: String) {
                    // Spooler accepted dialog
                }

                override fun onPrintFinished(jobId: String) {
                    repository.incrementCompletedJobs()
                    updateJobById(jobId) { it.copy(status = PrintJobStatus.COMPLETED) }
                    wsManager.sendJobStatusUpdate(jobId, PrintJobStatus.COMPLETED)
                }

                override fun onPrintError(jobId: String, errorMessage: String) {
                    updateJobById(jobId) { it.copy(status = PrintJobStatus.FAILED, errorMessage = errorMessage) }
                    wsManager.sendJobStatusUpdate(jobId, PrintJobStatus.FAILED, errorMessage)
                }
            }
        )

        if (!success) {
            updateJob(job.copy(status = PrintJobStatus.FAILED, errorMessage = "Failed to launch Android Print Dialog"))
            wsManager.sendJobStatusUpdate(job.orderItemId, PrintJobStatus.FAILED, "Print dialog failed")
        }
    }

    /**
     * Injects a sample print job with a generated valid PDF file for local terminal testing.
     */
    fun simulateTestJob() {
        val testId = "TEST-${(1000..9999).random()}"
        val sampleTitles = listOf(
            "CS302_Algorithms_Lecture_04.pdf",
            "Campus_Library_Research_Paper.pdf",
            "Project_Proposal_Draft_Final.pdf",
            "Engineering_Mathematics_Notes.pdf"
        )
        val title = sampleTitles.random()
        val mockPdf = downloader.createMockPdfFile(testId, title)

        val simulatedJob = PrintJob(
            orderItemId = testId,
            documentName = title,
            totalPages = (2..16).random(),
            colorMode = if ((0..1).random() == 0) ColorMode.BW else ColorMode.COLOR,
            duplexMode = if ((0..1).random() == 0) DuplexMode.DUPLEX_LONG else DuplexMode.SIMPLEX,
            paperSize = PaperSize.A4,
            copies = (1..3).random(),
            downloadUrl = "https://example.com/mock/$testId.pdf",
            localFilePath = mockPdf.absolutePath,
            status = PrintJobStatus.READY_TO_PRINT
        )

        repository.incrementReceivedJobs()
        _uiState.value = _uiState.value.copy(
            jobs = listOf(simulatedJob) + _uiState.value.jobs,
            userMessage = "Injected simulated test job #$testId"
        )
    }

    fun clearCompletedJobs() {
        _uiState.value = _uiState.value.copy(
            jobs = _uiState.value.jobs.filter { it.status != PrintJobStatus.COMPLETED }
        )
    }

    private fun updateJob(updatedJob: PrintJob) {
        _uiState.value = _uiState.value.copy(
            jobs = _uiState.value.jobs.map { if (it.orderItemId == updatedJob.orderItemId) updatedJob else it }
        )
    }

    private fun updateJobById(jobId: String, transform: (PrintJob) -> PrintJob) {
        _uiState.value = _uiState.value.copy(
            jobs = _uiState.value.jobs.map { if (it.orderItemId == jobId) transform(it) else it }
        )
    }
}

