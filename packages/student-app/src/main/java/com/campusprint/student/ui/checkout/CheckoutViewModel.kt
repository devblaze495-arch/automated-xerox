package com.campusprint.student.ui.checkout

import android.content.Context
import android.content.Intent
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.campusprint.student.data.api.ApiClient
import com.campusprint.student.data.model.CreateOrderRequest
import com.campusprint.student.data.model.CreatedOrderData
import com.campusprint.student.data.model.OrderItemRequest
import com.campusprint.student.data.repository.CenterRepository
import com.campusprint.student.data.repository.OrderHistoryRepository
import com.campusprint.student.data.repository.SavedOrderPass
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

sealed class CheckoutUiState {
    object Idle : CheckoutUiState()
    object CreatingOrder : CheckoutUiState()
    data class OrderReady(val order: CreatedOrderData, val upiUri: String) : CheckoutUiState()
    data class PaymentConfirmed(val orderId: String, val otp: String, val totalAmountCents: Long) : CheckoutUiState()
    data class Error(val message: String) : CheckoutUiState()
}

class CheckoutViewModel : ViewModel() {

    private val _uiState = MutableStateFlow<CheckoutUiState>(CheckoutUiState.Idle)
    val uiState: StateFlow<CheckoutUiState> = _uiState.asStateFlow()

    private var createdOrder: CreatedOrderData? = null
    private var lastFileName: String = "document.pdf"

    fun initiateOrderAndPay(
        context: Context,
        documentId: String,
        fileName: String,
        colorMode: String,
        paperSize: String,
        duplexMode: String,
        copies: Int,
        pageCount: Int,
        studentPhone: String = ""
    ) {
        lastFileName = fileName
        if (studentPhone.isNotBlank()) {
            CenterRepository.savePhone(studentPhone)
        }

        viewModelScope.launch {
            _uiState.value = CheckoutUiState.CreatingOrder

            try {
                val selectedCenter = CenterRepository.selectedCenter.value
                val request = CreateOrderRequest(
                    centerId = selectedCenter.id,
                    studentPhone = studentPhone.ifBlank { null },
                    items = listOf(
                        OrderItemRequest(
                            documentId = documentId,
                            pageRange = "ALL",
                            colorMode = colorMode,
                            paperSize = paperSize,
                            duplexMode = duplexMode,
                            copies = copies,
                            pageCount = pageCount
                        )
                    )
                )

                val response = withContext(Dispatchers.IO) {
                    ApiClient.getApi().createOrder(request)
                }

                if (response.isSuccessful && response.body()?.success == true) {
                    val order = response.body()?.data
                    if (order != null) {
                        createdOrder = order
                        val amountFormatted = String.format("%.2f", order.totalAmountRupees)
                        val upiUriString = "upi://pay?pa=campusprint@upi&pn=CampusPrint&am=${amountFormatted}&cu=INR&tn=${order.orderId}"

                        // Save initial pass in local history
                        OrderHistoryRepository.savePass(
                            SavedOrderPass(
                                orderId = order.orderId,
                                collectionOtp = order.collectionOtp,
                                centerName = selectedCenter.name,
                                fileName = fileName,
                                totalAmountCents = order.totalAmountCents,
                                totalSheets = order.totalSheets
                            )
                        )

                        _uiState.value = CheckoutUiState.OrderReady(order, upiUriString)

                        // Launch UPI App Chooser
                        launchUpiChooser(context, upiUriString)
                    } else {
                        _uiState.value = CheckoutUiState.Error("Server returned empty order record.")
                    }
                } else {
                    val errorMsg = response.errorBody()?.string() ?: "Failed to generate order (HTTP ${response.code()})"
                    _uiState.value = CheckoutUiState.Error(errorMsg)
                }
            } catch (e: Exception) {
                _uiState.value = CheckoutUiState.Error(e.localizedMessage ?: "Network error creating order")
            }
        }
    }

    fun launchUpiChooser(context: Context, upiUriString: String) {
        try {
            val upiUri = Uri.parse(upiUriString)
            val intent = Intent(Intent.ACTION_VIEW, upiUri)
            val chooser = Intent.createChooser(intent, "Pay with UPI (GPay, PhonePe, Paytm, BHIM)")
            chooser.flags = Intent.FLAG_ACTIVITY_NEW_TASK
            context.startActivity(chooser)
        } catch (_: Exception) {
            // Chooser exception or no apps found - keep state as OrderReady so user can simulate or retry
        }
    }

    /**
     * Automatically polled when student returns from the external UPI app
     */
    fun checkPaymentStatusOnResume() {
        val current = createdOrder ?: return
        if (_uiState.value is CheckoutUiState.PaymentConfirmed) return

        viewModelScope.launch {
            try {
                val response = withContext(Dispatchers.IO) {
                    ApiClient.getApi().getOrder(current.orderId)
                }
                if (response.isSuccessful && response.body()?.success == true) {
                    val orderData = response.body()?.data
                    if (orderData != null) {
                        val st = orderData.status.uppercase()
                        if (st == "PAID" || st == "PAYMENT_VERIFIED" || st == "QUEUED" ||
                            st == "PRINTING" || st == "READY_FOR_COLLECTION" ||
                            st == "COLLECTED" || st == "COMPLETED"
                        ) {
                            val selectedCenter = CenterRepository.selectedCenter.value
                            OrderHistoryRepository.savePass(
                                SavedOrderPass(
                                    orderId = orderData.id,
                                    collectionOtp = orderData.collectionOtp,
                                    centerName = selectedCenter.name,
                                    fileName = lastFileName,
                                    totalAmountCents = orderData.totalAmountCents,
                                    totalSheets = orderData.totalSheets
                                )
                            )
                            _uiState.value = CheckoutUiState.PaymentConfirmed(
                                orderId = orderData.id,
                                otp = orderData.collectionOtp,
                                totalAmountCents = orderData.totalAmountCents
                            )
                        }
                    }
                }
            } catch (_: Exception) {}
        }
    }

    fun simulatePaymentSuccess() {
        val current = createdOrder ?: return

        viewModelScope.launch {
            try {
                val response = withContext(Dispatchers.IO) {
                    ApiClient.getApi().confirmPayment(current.orderId)
                }

                val selectedCenter = CenterRepository.selectedCenter.value
                OrderHistoryRepository.savePass(
                    SavedOrderPass(
                        orderId = current.orderId,
                        collectionOtp = current.collectionOtp,
                        centerName = selectedCenter.name,
                        fileName = lastFileName,
                        totalAmountCents = current.totalAmountCents,
                        totalSheets = current.totalSheets
                    )
                )

                if (response.isSuccessful && response.body()?.success == true) {
                    _uiState.value = CheckoutUiState.PaymentConfirmed(
                        orderId = current.orderId,
                        otp = current.collectionOtp,
                        totalAmountCents = current.totalAmountCents
                    )
                } else {
                    _uiState.value = CheckoutUiState.PaymentConfirmed(
                        orderId = current.orderId,
                        otp = current.collectionOtp,
                        totalAmountCents = current.totalAmountCents
                    )
                }
            } catch (_: Exception) {
                _uiState.value = CheckoutUiState.PaymentConfirmed(
                    orderId = current.orderId,
                    otp = current.collectionOtp,
                    totalAmountCents = current.totalAmountCents
                )
            }
        }
    }
}
