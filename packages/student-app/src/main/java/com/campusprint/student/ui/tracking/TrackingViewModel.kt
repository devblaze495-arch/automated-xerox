package com.campusprint.student.ui.tracking

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.campusprint.student.data.api.ApiClient
import com.campusprint.student.data.model.OrderDetailsData
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

data class TrackingUiState(
    val orderId: String = "",
    val status: String = "ORDER_PLACED",
    val collectionOtp: String = "----",
    val totalSheets: Int = 1,
    val totalAmountCents: Long = 0L,
    val queuePosition: Int? = null,
    val estimatedWaitMinutes: Int? = null,
    val isLoading: Boolean = true,
    val errorMessage: String? = null
)

class TrackingViewModel : ViewModel() {

    private val _uiState = MutableStateFlow(TrackingUiState())
    val uiState: StateFlow<TrackingUiState> = _uiState.asStateFlow()

    private var pollJob: Job? = null

    fun startTracking(orderId: String, initialOtp: String, totalAmountCents: Long) {
        _uiState.value = _uiState.value.copy(
            orderId = orderId,
            collectionOtp = initialOtp,
            totalAmountCents = totalAmountCents,
            isLoading = true
        )

        pollJob?.cancel()
        pollJob = viewModelScope.launch {
            while (isActive) {
                try {
                    val response = withContext(Dispatchers.IO) {
                        ApiClient.getApi().getOrder(orderId)
                    }

                    if (response.isSuccessful && response.body()?.success == true) {
                        val order = response.body()?.data
                        if (order != null) {
                            _uiState.value = _uiState.value.copy(
                                status = order.status,
                                collectionOtp = order.collectionOtp.ifEmpty { initialOtp },
                                totalSheets = order.totalSheets,
                                totalAmountCents = order.totalAmountCents,
                                queuePosition = order.queuePosition,
                                estimatedWaitMinutes = order.estimatedWaitMinutes,
                                isLoading = false,
                                errorMessage = null
                            )

                            // Stop polling if collected
                            if (order.status == "COLLECTED" || order.status == "COMPLETED") {
                                break
                            }
                        }
                    }
                } catch (e: Exception) {
                    // Soft fail, retry in next poll tick
                }

                delay(3000) // Poll every 3 seconds
            }
        }
    }

    override fun onCleared() {
        super.onCleared()
        pollJob?.cancel()
    }
}

