package com.campusprint.student.data.model

import com.google.gson.annotations.SerializedName

data class PricingRequest(
    @SerializedName("pageCount") val pageCount: Int,
    @SerializedName("pageRange") val pageRange: String = "ALL",
    @SerializedName("colorMode") val colorMode: String = "BW",
    @SerializedName("paperSize") val paperSize: String = "A4",
    @SerializedName("duplexMode") val duplexMode: String = "SIMPLEX",
    @SerializedName("copies") val copies: Int = 1
)

data class PricingResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("data") val data: PricingData? = null,
    @SerializedName("error") val error: String? = null
)

data class PricingData(
    @SerializedName("effectivePages") val effectivePages: Int = 1,
    @SerializedName("sheetsPerCopy") val sheetsPerCopy: Int = 1,
    @SerializedName("totalSheets") val totalSheets: Int = 1,
    @SerializedName("totalImpressions") val totalImpressions: Int = 1,
    @SerializedName("basePaperCents") val basePaperCents: Long = 0,
    @SerializedName("tonerCents") val tonerCents: Long = 0,
    @SerializedName("subtotalCents") val subtotalCents: Long = 0,
    @SerializedName("itemTotalCents") val itemTotalCents: Long = 0
) {
    val itemTotalRupees: Double
        get() = itemTotalCents / 100.0
}

