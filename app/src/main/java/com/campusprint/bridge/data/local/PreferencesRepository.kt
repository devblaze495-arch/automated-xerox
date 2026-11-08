package com.campusprint.bridge.data.local

import android.content.Context
import android.content.SharedPreferences
import com.campusprint.bridge.data.model.DeviceConfig
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

/**
 * Repository to persist operator terminal configuration and stats locally.
 */
class PreferencesRepository(context: Context) {

    private val prefs: SharedPreferences = context.getSharedPreferences(
        PREFS_NAME,
        Context.MODE_PRIVATE
    )

    private val _configFlow = MutableStateFlow(loadConfig())
    val configFlow: StateFlow<DeviceConfig> = _configFlow.asStateFlow()

    private val _totalJobsReceived = MutableStateFlow(prefs.getInt(KEY_TOTAL_RECEIVED, 0))
    val totalJobsReceived: StateFlow<Int> = _totalJobsReceived.asStateFlow()

    private val _totalJobsCompleted = MutableStateFlow(prefs.getInt(KEY_TOTAL_COMPLETED, 0))
    val totalJobsCompleted: StateFlow<Int> = _totalJobsCompleted.asStateFlow()

    fun loadConfig(): DeviceConfig {
        return DeviceConfig(
            serverUrl = prefs.getString(KEY_SERVER_URL, "ws://10.0.2.2:4000/api/v1/agent/socket")
                ?: "ws://10.0.2.2:4000/api/v1/agent/socket",
            centerId = prefs.getString(KEY_CENTER_ID, "CTR-CAMPUS-01") ?: "CTR-CAMPUS-01",
            secretToken = prefs.getString(KEY_SECRET_TOKEN, "") ?: "",
            autoDownload = prefs.getBoolean(KEY_AUTO_DOWNLOAD, false),
            autoPrint = prefs.getBoolean(KEY_AUTO_PRINT, false)
        )
    }

    fun saveConfig(config: DeviceConfig) {
        prefs.edit()
            .putString(KEY_SERVER_URL, config.serverUrl.trim())
            .putString(KEY_CENTER_ID, config.centerId.trim())
            .putString(KEY_SECRET_TOKEN, config.secretToken.trim())
            .putBoolean(KEY_AUTO_DOWNLOAD, config.autoDownload)
            .putBoolean(KEY_AUTO_PRINT, config.autoPrint)
            .apply()
        _configFlow.value = config
    }

    fun incrementReceivedJobs() {
        val newCount = _totalJobsReceived.value + 1
        prefs.edit().putInt(KEY_TOTAL_RECEIVED, newCount).apply()
        _totalJobsReceived.value = newCount
    }

    fun incrementCompletedJobs() {
        val newCount = _totalJobsCompleted.value + 1
        prefs.edit().putInt(KEY_TOTAL_COMPLETED, newCount).apply()
        _totalJobsCompleted.value = newCount
    }

    companion object {
        private const val PREFS_NAME = "campus_print_bridge_prefs"
        private const val KEY_SERVER_URL = "key_server_url"
        private const val KEY_CENTER_ID = "key_center_id"
        private const val KEY_SECRET_TOKEN = "key_secret_token"
        private const val KEY_AUTO_DOWNLOAD = "key_auto_download"
        private const val KEY_AUTO_PRINT = "key_auto_print"
        private const val KEY_TOTAL_RECEIVED = "key_total_received"
        private const val KEY_TOTAL_COMPLETED = "key_total_completed"
    }
}

