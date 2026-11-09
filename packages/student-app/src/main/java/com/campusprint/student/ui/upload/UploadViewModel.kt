package com.campusprint.student.ui.upload

import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.campusprint.student.data.api.ApiClient
import com.campusprint.student.data.model.DocumentData
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody

sealed class UploadUiState {
    object Idle : UploadUiState()
    data class FileSelected(val uri: Uri, val fileName: String, val fileSizeBytes: Long) : UploadUiState()
    data class Uploading(val progress: Float, val fileName: String) : UploadUiState()
    data class Success(val documentData: DocumentData) : UploadUiState()
    data class Error(val message: String) : UploadUiState()
}

class UploadViewModel : ViewModel() {

    private val _uiState = MutableStateFlow<UploadUiState>(UploadUiState.Idle)
    val uiState: StateFlow<UploadUiState> = _uiState.asStateFlow()

    fun onFileSelected(context: Context, uri: Uri) {
        val (fileName, sizeBytes) = getMetadata(context, uri)

        if (sizeBytes > 50 * 1024 * 1024) {
            _uiState.value = UploadUiState.Error("Selected PDF exceeds maximum limit of 50 MB.")
            return
        }

        _uiState.value = UploadUiState.FileSelected(
            uri = uri,
            fileName = fileName,
            fileSizeBytes = sizeBytes
        )
    }

    fun uploadDocument(context: Context) {
        val currentState = _uiState.value
        if (currentState !is UploadUiState.FileSelected) return

        val uri = currentState.uri
        val fileName = currentState.fileName
        val sizeBytes = currentState.fileSizeBytes

        viewModelScope.launch {
            _uiState.value = UploadUiState.Uploading(progress = 0.25f, fileName = fileName)

            try {
                val bytes = withContext(Dispatchers.IO) {
                    context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
                }

                if (bytes == null || bytes.isEmpty()) {
                    _uiState.value = UploadUiState.Error("Unable to read selected PDF file.")
                    return@launch
                }

                _uiState.value = UploadUiState.Uploading(progress = 0.65f, fileName = fileName)

                val requestBody = bytes.toRequestBody("application/pdf".toMediaTypeOrNull())
                val multipart = MultipartBody.Part.createFormData("file", fileName, requestBody)

                val response = withContext(Dispatchers.IO) {
                    ApiClient.getApi().uploadDocument(multipart)
                }

                if (response.isSuccessful && response.body()?.success == true) {
                    val data = response.body()?.data
                    if (data != null) {
                        _uiState.value = UploadUiState.Success(data)
                    } else {
                        _uiState.value = UploadUiState.Error("Empty response data from server.")
                    }
                } else {
                    val errorMsg = response.body()?.message
                        ?: response.errorBody()?.string()
                        ?: "Upload failed with HTTP ${response.code()}"
                    _uiState.value = UploadUiState.Error(errorMsg)
                }
            } catch (e: Exception) {
                _uiState.value = UploadUiState.Error(e.localizedMessage ?: "Failed to upload document")
            }
        }
    }

    fun resetState() {
        _uiState.value = UploadUiState.Idle
    }

    private fun getMetadata(context: Context, uri: Uri): Pair<String, Long> {
        var name = "document.pdf"
        var size = 0L

        try {
            context.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
                val nameIndex = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                val sizeIndex = cursor.getColumnIndex(OpenableColumns.SIZE)
                if (cursor.moveToFirst()) {
                    if (nameIndex != -1) name = cursor.getString(nameIndex) ?: name
                    if (sizeIndex != -1) size = cursor.getLong(sizeIndex)
                }
            }
        } catch (_: Exception) {}

        return Pair(name, size)
    }
}

