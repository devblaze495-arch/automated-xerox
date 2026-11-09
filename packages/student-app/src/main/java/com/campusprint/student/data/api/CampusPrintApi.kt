package com.campusprint.student.data.api

import com.campusprint.student.data.model.ConfirmPaymentResponse
import com.campusprint.student.data.model.CreateOrderRequest
import com.campusprint.student.data.model.CreateOrderResponse
import com.campusprint.student.data.model.DocumentUploadResponse
import com.campusprint.student.data.model.OrderDetailsResponse
import com.campusprint.student.data.model.PricingRequest
import com.campusprint.student.data.model.PricingResponse
import okhttp3.MultipartBody
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.Part
import retrofit2.http.Path

interface CampusPrintApi {

    @Multipart
    @POST("api/v1/documents/upload")
    suspend fun uploadDocument(
        @Part file: MultipartBody.Part
    ): Response<DocumentUploadResponse>

    @POST("api/v1/pricing/calculate")
    suspend fun calculatePrice(
        @Body request: PricingRequest
    ): Response<PricingResponse>

    @POST("api/v1/orders/create")
    suspend fun createOrder(
        @Body request: CreateOrderRequest
    ): Response<CreateOrderResponse>

    @POST("api/v1/orders/{id}/confirm-payment")
    suspend fun confirmPayment(
        @Path("id") orderId: String
    ): Response<ConfirmPaymentResponse>

    @GET("api/v1/orders/{id}")
    suspend fun getOrder(
        @Path("id") orderId: String
    ): Response<OrderDetailsResponse>
}

