package com.campusprint.student.data.model

import com.google.gson.annotations.SerializedName

data class DocumentUploadResponse(
    @SerializedName("success") val success: Boolean,
    @SerializedName("data") val data: DocumentData? = null,
    @SerializedName("error") val error: String? = null,
    @SerializedName("message") val message: String? = null
)

data class DocumentData(
    @SerializedName("documentId") val documentId: String,
    @SerializedName("fileName") val fileName: String,
    @SerializedName("pageCount") val pageCount: Int,
    @SerializedName("fileSizeBytes") val fileSizeBytes: Long,
    @SerializedName("sha256Hash") val sha256Hash: String? = null,
    @SerializedName("downloadUrl") val downloadUrl: String? = null,
    @SerializedName("createdAt") val createdAt: String? = null
)

