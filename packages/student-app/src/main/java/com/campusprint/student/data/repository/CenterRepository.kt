package com.campusprint.student.data.repository

import android.content.Context
import android.content.SharedPreferences
import android.net.Uri
import com.campusprint.student.data.api.ApiClient
import com.campusprint.student.data.model.PrintCenter
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.withContext

object CenterRepository {

    private const val PREFS_NAME = "campus_print_prefs"
    private const val KEY_CENTER_ID = "pref_center_id"
    private const val KEY_CENTER_CODE = "pref_center_code"
    private const val KEY_CENTER_NAME = "pref_center_name"
    private const val KEY_CENTER_LOCATION = "pref_center_location"
    private const val KEY_CENTER_IS_OPEN = "pref_center_is_open"
    private const val KEY_CENTER_BW_RATE = "pref_center_bw_rate"
    private const val KEY_CENTER_COLOR_RATE = "pref_center_color_rate"
    private const val KEY_STUDENT_PHONE = "pref_student_phone"

    val DEFAULT_CENTER = PrintCenter(
        id = "00000000-0000-0000-0000-000000000002",
        code = "CTR-CAMPUS-01",
        name = "Central Library Print Station",
        location = "Central Library, Ground Floor, Block A",
        isOpen = true,
        bwRatePerSheet = 2.0,
        colorRatePerSheet = 10.0,
        a3Multiplier = 2.0
    )

    private val _selectedCenter = MutableStateFlow(DEFAULT_CENTER)
    val selectedCenter: StateFlow<PrintCenter> = _selectedCenter.asStateFlow()

    private val _availableCenters = MutableStateFlow<List<PrintCenter>>(listOf(DEFAULT_CENTER))
    val availableCenters: StateFlow<List<PrintCenter>> = _availableCenters.asStateFlow()

    private var prefs: SharedPreferences? = null

    fun initialize(context: Context) {
        if (prefs == null) {
            prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            loadSavedCenter()
        }
    }

    private fun loadSavedCenter() {
        val sp = prefs ?: return
        val id = sp.getString(KEY_CENTER_ID, DEFAULT_CENTER.id) ?: DEFAULT_CENTER.id
        val code = sp.getString(KEY_CENTER_CODE, DEFAULT_CENTER.code) ?: DEFAULT_CENTER.code
        val name = sp.getString(KEY_CENTER_NAME, DEFAULT_CENTER.name) ?: DEFAULT_CENTER.name
        val location = sp.getString(KEY_CENTER_LOCATION, DEFAULT_CENTER.location) ?: DEFAULT_CENTER.location
        val isOpen = sp.getBoolean(KEY_CENTER_IS_OPEN, DEFAULT_CENTER.isOpen)
        val bwRate = sp.getFloat(KEY_CENTER_BW_RATE, DEFAULT_CENTER.bwRatePerSheet.toFloat()).toDouble()
        val colorRate = sp.getFloat(KEY_CENTER_COLOR_RATE, DEFAULT_CENTER.colorRatePerSheet.toFloat()).toDouble()

        _selectedCenter.value = PrintCenter(
            id = id,
            code = code,
            name = name,
            location = location,
            isOpen = isOpen,
            bwRatePerSheet = bwRate,
            colorRatePerSheet = colorRate
        )
    }

    fun selectCenter(center: PrintCenter) {
        _selectedCenter.value = center
        prefs?.edit()?.apply {
            putString(KEY_CENTER_ID, center.id)
            putString(KEY_CENTER_CODE, center.code)
            putString(KEY_CENTER_NAME, center.name)
            putString(KEY_CENTER_LOCATION, center.location)
            putBoolean(KEY_CENTER_IS_OPEN, center.isOpen)
            putFloat(KEY_CENTER_BW_RATE, center.bwRatePerSheet.toFloat())
            putFloat(KEY_CENTER_COLOR_RATE, center.colorRatePerSheet.toFloat())
            apply()
        }
    }

    suspend fun refreshCenters(): List<PrintCenter> {
        return withContext(Dispatchers.IO) {
            try {
                val response = ApiClient.getApi().getActiveCenters()
                if (response.isSuccessful && response.body()?.success == true) {
                    val list = response.body()?.data ?: emptyList()
                    if (list.isNotEmpty()) {
                        _availableCenters.value = list

                        // If current selected center exists in refreshed list, update its live status/rates
                        val current = _selectedCenter.value
                        val updated = list.find { it.id == current.id || it.code.equals(current.code, ignoreCase = true) }
                        if (updated != null) {
                            selectCenter(updated)
                        }
                        return@withContext list
                    }
                }
            } catch (_err: Exception) {
                // Return cached fallback
            }
            return@withContext _availableCenters.value
        }
    }

    /**
     * Parses QR scan or deep link payload to select matching center
     */
    fun selectFromQrCodeOrDeepLink(rawString: String): Boolean {
        val trimmed = rawString.trim()
        val centerCode = when {
            // e.g. https://print.domain.com/download/CampusPrint.apk?center=CTR-CAMPUS-01
            trimmed.contains("?center=") || trimmed.contains("&center=") -> {
                try {
                    val uri = Uri.parse(trimmed)
                    uri.getQueryParameter("center") ?: ""
                } catch (_: Exception) {
                    ""
                }
            }
            // Direct center code or prefixed format
            trimmed.startsWith("CTR-", ignoreCase = true) -> trimmed
            else -> trimmed
        }

        if (centerCode.isNotBlank()) {
            val match = _availableCenters.value.find {
                it.code.equals(centerCode, ignoreCase = true) || it.id.equals(centerCode, ignoreCase = true)
            }
            if (match != null) {
                selectCenter(match)
                return true
            } else {
                // If not yet in list, update selected center with the scanned code
                selectCenter(DEFAULT_CENTER.copy(code = centerCode.uppercase()))
                return true
            }
        }
        return false
    }

    fun getSavedPhone(): String {
        return prefs?.getString(KEY_STUDENT_PHONE, "") ?: ""
    }

    fun savePhone(phone: String) {
        val clean = phone.filter { it.isDigit() }.takeLast(10)
        prefs?.edit()?.putString(KEY_STUDENT_PHONE, clean)?.apply()
    }
}

