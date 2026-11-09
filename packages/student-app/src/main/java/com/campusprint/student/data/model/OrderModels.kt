package com.campusprint.student.data.model

import com.google.gson.annotations.SerializedName

data class CreateOrderRequest(
    @SerializedName("studentId") val studentId: String = "00000000-0000-0000-0000-000000000001",
    @SerializedName("centerId") val centerId: String = "00000000-0000-0000-0000-000000000002",
    @SerializedName("items") val items: List<OrderItemRequest>
)

data class OrderItemRequest(
    @SerializedName("documentId") val documentId: String,
    @SerializedName("pageRange") val pageRange: String = "ALL",
    @SerializedName("colorMode") val colorMode: String,
    @SerializedName("paperSize") val paperSize: String,
    @SerializedName("duplexMode") val duplexMode: String,
    @SerializedName("copies") val copies: Int,
    @SerializedName("pageCount") val pageCount: Int
)

data class CreateOrderResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("data") val data: CreatedOrderData? = null,
    @SerializedName("error") val error: String? = null
)

data class CreatedOrderData(
    @SerializedName("orderId") val orderId: String,
    @SerializedName("status") val status: String,
    @SerializedName("collectionOtp") val collectionOtp: String,
    @SerializedName("totalSheets") val totalSheets: Int,
    @SerializedName("subtotalCents") val subtotalCents: Long,
    @SerializedName("convenienceFeeCents") val convenienceFeeCents: Long,
    @SerializedName("totalAmountCents") val totalAmountCents: Long
) {
    val totalAmountRupees: Double
        get() = totalAmountCents / 100.0
}

data class ConfirmPaymentResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("message") val message: String? = null,
    @SerializedName("orderId") val orderId: String? = null,
    @SerializedName("status") val status: String? = null,
    @SerializedName("error") val error: String? = null
)

data class OrderDetailsResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("data") val data: OrderDetailsData? = null,
    @SerializedName("error") val error: String? = null
)

data class OrderDetailsData(
    @SerializedName("id") val id: String,
    @SerializedName("status") val status: String,
    @SerializedName("collectionOtp") val collectionOtp: String,
    @SerializedName("totalSheets") val totalSheets: Int,
    @SerializedName("totalAmountCents") val totalAmountCents: Long,
    @SerializedName("subtotalCents") val subtotalCents: Long? = null,
    @SerializedName("convenienceFeeCents") val convenienceFeeCents: Long? = null,
    @SerializedName("items") val items: List<OrderItemDetail>? = null,
    @SerializedName("queuePosition") val queuePosition: Int? = null,
    @SerializedName("estimatedWaitMinutes") val estimatedWaitMinutes: Int? = null,
    @SerializedName("createdAt") val createdAt: String? = null
) {
    val totalAmountRupees: Double
        get() = totalAmountCents / 100.0
}

data class OrderItemDetail(
    @SerializedName("id") val id: String,
    @SerializedName("documentName") val documentName: String,
    @SerializedName("totalPages") val totalPages: Int,
    @SerializedName("colorMode") val colorMode: String,
    @SerializedName("duplexMode") val duplexMode: String,
    @SerializedName("paperSize") val paperSize: String,
    @SerializedName("copies") val copies: Int,
    @SerializedName("computedSheets") val computedSheets: Int? = null,
    @SerializedName("itemTotalCents") val itemTotalCents: Long? = null
)

