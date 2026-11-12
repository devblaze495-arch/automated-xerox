package com.campusprint.student.data.repository

import android.content.Context
import android.content.SharedPreferences
import com.google.gson.Gson
import com.google.gson.reflect.TypeToken
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

data class SavedOrderPass(
    val orderId: String,
    val collectionOtp: String,
    val centerName: String,
    val fileName: String,
    val totalAmountCents: Long,
    val totalSheets: Int = 1,
    val createdAt: Long = System.currentTimeMillis()
) {
    val totalAmountRupees: Double
        get() = totalAmountCents / 100.0
}

object OrderHistoryRepository {

    private const val PREFS_NAME = "campus_print_order_history"
    private const val KEY_ORDERS = "saved_order_passes"
    private val gson = Gson()

    private var prefs: SharedPreferences? = null

    private val _savedPasses = MutableStateFlow<List<SavedOrderPass>>(emptyList())
    val savedPasses: StateFlow<List<SavedOrderPass>> = _savedPasses.asStateFlow()

    fun initialize(context: Context) {
        if (prefs == null) {
            prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            loadPasses()
        }
    }

    private fun loadPasses() {
        val json = prefs?.getString(KEY_ORDERS, null) ?: return
        try {
            val type = object : TypeToken<List<SavedOrderPass>>() {}.type
            val list: List<SavedOrderPass> = gson.fromJson(json, type) ?: emptyList()
            _savedPasses.value = list
        } catch (_: Exception) {}
    }

    fun savePass(pass: SavedOrderPass) {
        val current = _savedPasses.value.toMutableList()
        // Deduplicate by orderId
        current.removeAll { it.orderId == pass.orderId }
        current.add(0, pass)
        // Keep up to 20 recent passes
        val trimmed = current.take(20)
        _savedPasses.value = trimmed

        prefs?.edit()?.putString(KEY_ORDERS, gson.toJson(trimmed))?.apply()
    }

    fun getPasses(): List<SavedOrderPass> = _savedPasses.value
}

