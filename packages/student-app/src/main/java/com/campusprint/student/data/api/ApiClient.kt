package com.campusprint.student.data.api

import android.content.Context
import android.content.SharedPreferences
import com.campusprint.student.BuildConfig
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

object ApiClient {

    private const val PREFS_NAME = "campus_print_api_prefs"
    private const val KEY_CUSTOM_URL = "custom_base_url"

    private val DEFAULT_URL: String
        get() = if (BuildConfig.DEFAULT_API_URL.endsWith("/")) {
            BuildConfig.DEFAULT_API_URL
        } else {
            "${BuildConfig.DEFAULT_API_URL}/"
        }

    @Volatile
    private var currentBaseUrl: String = DEFAULT_URL

    @Volatile
    private var retrofitInstance: Retrofit? = null

    @Volatile
    private var apiInstance: CampusPrintApi? = null

    private var prefs: SharedPreferences? = null

    fun initialize(context: Context) {
        if (prefs == null) {
            prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val saved = prefs?.getString(KEY_CUSTOM_URL, null)?.trim()
            if (!saved.isNullOrBlank()) {
                currentBaseUrl = if (!saved.endsWith("/")) "$saved/" else saved
            } else {
                currentBaseUrl = DEFAULT_URL
            }
        }
    }

    fun getBaseUrl(): String = currentBaseUrl

    fun getDefaultUrl(): String = DEFAULT_URL

    fun setBaseUrl(url: String) {
        val trimmed = url.trim()
        val normalized = if (trimmed.isBlank()) {
            DEFAULT_URL
        } else if (!trimmed.endsWith("/")) {
            "$trimmed/"
        } else {
            trimmed
        }

        if (currentBaseUrl != normalized) {
            currentBaseUrl = normalized
            retrofitInstance = null
            apiInstance = null
        }

        prefs?.edit()?.putString(KEY_CUSTOM_URL, if (normalized == DEFAULT_URL) "" else normalized)?.apply()
    }

    private val okHttpClient: OkHttpClient by lazy {
        val logging = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
        }
        OkHttpClient.Builder()
            .addInterceptor(logging)
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .writeTimeout(60, TimeUnit.SECONDS)
            .build()
    }

    fun getApi(): CampusPrintApi {
        return apiInstance ?: synchronized(this) {
            val retrofit = retrofitInstance ?: Retrofit.Builder()
                .baseUrl(currentBaseUrl)
                .client(okHttpClient)
                .addConverterFactory(GsonConverterFactory.create())
                .build().also { retrofitInstance = it }

            retrofit.create(CampusPrintApi::class.java).also { apiInstance = it }
        }
    }
}
