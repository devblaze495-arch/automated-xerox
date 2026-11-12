package com.campusprint.student.ui.configure

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.campusprint.student.data.api.ApiClient
import com.campusprint.student.data.model.PricingData
import com.campusprint.student.data.model.PricingRequest
import com.campusprint.student.data.repository.CenterRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

data class ConfigureUiState(
    val documentId: String = "",
    val fileName: String = "",
    val pageCount: Int = 1,
    val fileSizeBytes: Long = 0L,
    val colorMode: String = "BW",        // BW | COLOR
    val duplexMode: String = "SIMPLEX",  // SIMPLEX | DUPLEX_LONG
    val paperSize: String = "A4",        // A4 | A3
    val copies: Int = 1,
    val isCalculating: Boolean = false,
    val pricing: PricingData = PricingData(),
    val errorMessage: String? = null
)

class ConfigureViewModel : ViewModel() {

    private val _uiState = MutableStateFlow(ConfigureUiState())
    val uiState: StateFlow<ConfigureUiState> = _uiState.asStateFlow()

    private var pricingJob: Job? = null

    fun initialize(documentId: String, fileName: String, pageCount: Int, fileSizeBytes: Long) {
        _uiState.value = _uiState.value.copy(
            documentId = documentId,
            fileName = fileName,
            pageCount = if (pageCount > 0) pageCount else 1,
            fileSizeBytes = fileSizeBytes
        )
        recalculatePricing()
    }

    fun setColorMode(colorMode: String) {
        _uiState.value = _uiState.value.copy(colorMode = colorMode)
        recalculatePricing()
    }

    fun setDuplexMode(duplexMode: String) {
        _uiState.value = _uiState.value.copy(duplexMode = duplexMode)
        recalculatePricing()
    }

    fun setPaperSize(paperSize: String) {
        _uiState.value = _uiState.value.copy(paperSize = paperSize)
        recalculatePricing()
    }

    fun incrementCopies() {
        if (_uiState.value.copies < 100) {
            _uiState.value = _uiState.value.copy(copies = _uiState.value.copies + 1)
            recalculatePricing()
        }
    }

    fun decrementCopies() {
        if (_uiState.value.copies > 1) {
            _uiState.value = _uiState.value.copy(copies = _uiState.value.copies - 1)
            recalculatePricing()
        }
    }

    private fun recalculatePricing() {
        pricingJob?.cancel()
        pricingJob = viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isCalculating = true, errorMessage = null)
            delay(150) // Small debounce for smooth UI interaction

            val state = _uiState.value
            val request = PricingRequest(
                pageCount = state.pageCount,
                pageRange = "ALL",
                colorMode = state.colorMode,
                paperSize = state.paperSize,
                duplexMode = state.duplexMode,
                copies = state.copies
            )

            try {
                val response = withContext(Dispatchers.IO) {
                    ApiClient.getApi().calculatePrice(request)
                }

                if (response.isSuccessful && response.body()?.success == true) {
                    val data = response.body()?.data ?: PricingData()
                    _uiState.value = _uiState.value.copy(
                        pricing = data,
                        isCalculating = false
                    )
                } else {
                    // Fallback to local calculation if offline/temporary network blip
                    val fallback = calculateLocalFallback(state)
                    _uiState.value = _uiState.value.copy(
                        pricing = fallback,
                        isCalculating = false
                    )
                }
            } catch (e: Exception) {
                val fallback = calculateLocalFallback(state)
                _uiState.value = _uiState.value.copy(
                    pricing = fallback,
                    isCalculating = false
                )
            }
        }
    }

    private fun calculateLocalFallback(state: ConfigureUiState): PricingData {
        val center = CenterRepository.selectedCenter.value
        val sheetsPerCopy = if (state.duplexMode == "SIMPLEX") state.pageCount else Math.ceil(state.pageCount / 2.0).toInt()
        val totalSheets = sheetsPerCopy * state.copies
        val totalImpressions = state.pageCount * state.copies

        val baseRatePerSheetRupees = if (state.colorMode == "COLOR") center.colorRatePerSheet else center.bwRatePerSheet
        val multiplier = if (state.paperSize == "A3") center.a3Multiplier else 1.0
        val subtotalRupees = totalSheets * baseRatePerSheetRupees * multiplier
        val subtotalCents = Math.round(subtotalRupees * 100).toLong()

        return PricingData(
            effectivePages = state.pageCount,
            sheetsPerCopy = sheetsPerCopy,
            totalSheets = totalSheets,
            totalImpressions = totalImpressions,
            basePaperCents = subtotalCents / 2,
            tonerCents = subtotalCents / 2,
            subtotalCents = subtotalCents,
            itemTotalCents = subtotalCents
        )
    }
}

