package com.campusprint.student.data.model

import com.google.gson.annotations.SerializedName

data class PrintCenter(
    @SerializedName("id") val id: String,
    @SerializedName("code") val code: String,
    @SerializedName("name") val name: String,
    @SerializedName("location") val location: String,
    @SerializedName("isOpen") val isOpen: Boolean,
    @SerializedName("bwRatePerSheet") val bwRatePerSheet: Double,
    @SerializedName("colorRatePerSheet") val colorRatePerSheet: Double,
    @SerializedName("a3Multiplier") val a3Multiplier: Double = 2.0
)

data class CentersResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("total") val total: Int,
    @SerializedName("data") val data: List<PrintCenter>
)

