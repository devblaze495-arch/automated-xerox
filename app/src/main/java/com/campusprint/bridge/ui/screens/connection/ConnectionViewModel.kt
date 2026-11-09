package com.campusprint.bridge.ui.screens.connection

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.campusprint.bridge.CampusPrintApp
import com.campusprint.bridge.data.local.PreferencesRepository
import com.campusprint.bridge.data.model.ConnectionState
import com.campusprint.bridge.data.model.DeviceConfig
import com.campusprint.bridge.data.model.PresetEndpoints
import com.campusprint.bridge.data.remote.WebSocketManager
import com.campusprint.bridge.service.PrintBridgeForegroundService
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

data class ConnectionUiState(
    val serverUrl: String = PresetEndpoints.USB_ADB_REVERSE,
    val centerId: String = "CTR-CAMPUS-01",
    val secretToken: String = "",
    val autoDownload: Boolean = true,
    val autoPrint: Boolean = false,
    val isPasswordVisible: Boolean = false,
    val connectionState: ConnectionState = ConnectionState.Disconnected(),
    val totalReceived: Int = 0,
    val totalCompleted: Int = 0
)

class ConnectionViewModel(application: Application) : AndroidViewModel(application) {

    private val app = application as CampusPrintApp
    private val repository: PreferencesRepository = app.container.preferencesRepository
    private val wsManager: WebSocketManager = app.container.webSocketManager

    private val _uiState = MutableStateFlow(ConnectionUiState())
    val uiState: StateFlow<ConnectionUiState> = _uiState.asStateFlow()

    init {
        // Load initial config
        val savedConfig = repository.loadConfig()
        _uiState.value = _uiState.value.copy(
            serverUrl = savedConfig.serverUrl,
            centerId = savedConfig.centerId,
            secretToken = savedConfig.secretToken,
            autoDownload = savedConfig.autoDownload,
            autoPrint = savedConfig.autoPrint
        )

        // Observe connection state from WebSocketManager
        viewModelScope.launch {
            wsManager.connectionState.collectLatest { state ->
                _uiState.value = _uiState.value.copy(connectionState = state)

                // Manage foreground service lifecycle based on connection
                if (state is ConnectionState.Connected) {
                    PrintBridgeForegroundService.start(getApplication())
                }
            }
        }

        // Observe stats
        viewModelScope.launch {
            repository.totalJobsReceived.collectLatest { count ->
                _uiState.value = _uiState.value.copy(totalReceived = count)
            }
        }
        viewModelScope.launch {
            repository.totalJobsCompleted.collectLatest { count ->
                _uiState.value = _uiState.value.copy(totalCompleted = count)
            }
        }
    }

    fun onServerUrlChange(url: String) {
        _uiState.value = _uiState.value.copy(serverUrl = url)
    }

    fun onCenterIdChange(id: String) {
        _uiState.value = _uiState.value.copy(centerId = id)
    }

    fun onSecretTokenChange(token: String) {
        _uiState.value = _uiState.value.copy(secretToken = token)
    }

    fun togglePasswordVisibility() {
        _uiState.value = _uiState.value.copy(isPasswordVisible = !_uiState.value.isPasswordVisible)
    }

    fun onAutoDownloadChange(enabled: Boolean) {
        _uiState.value = _uiState.value.copy(autoDownload = enabled)
        saveCurrentConfig()
    }

    fun onAutoPrintChange(enabled: Boolean) {
        _uiState.value = _uiState.value.copy(autoPrint = enabled)
        saveCurrentConfig()
    }

    fun applyPresetUrl(url: String) {
        _uiState.value = _uiState.value.copy(serverUrl = url)
    }

    fun toggleConnection() {
        val currentState = _uiState.value.connectionState
        if (currentState is ConnectionState.Connected || currentState is ConnectionState.Connecting) {
            disconnect()
        } else {
            connect()
        }
    }

    fun connect() {
        saveCurrentConfig()
        val config = DeviceConfig(
            serverUrl = _uiState.value.serverUrl,
            centerId = _uiState.value.centerId,
            secretToken = _uiState.value.secretToken,
            autoDownload = _uiState.value.autoDownload,
            autoPrint = _uiState.value.autoPrint
        )
        wsManager.connect(config)
    }

    fun disconnect() {
        wsManager.disconnect("User disconnected from settings")
        PrintBridgeForegroundService.stop(getApplication())
    }

    private fun saveCurrentConfig() {
        val config = DeviceConfig(
            serverUrl = _uiState.value.serverUrl,
            centerId = _uiState.value.centerId,
            secretToken = _uiState.value.secretToken,
            autoDownload = _uiState.value.autoDownload,
            autoPrint = _uiState.value.autoPrint
        )
        repository.saveConfig(config)
    }
}

