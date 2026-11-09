package com.campusprint.student.data.api

import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

object ApiClient {

    private const val DEFAULT_EMULATOR_URL = "http://10.0.2.2:4000/"
    private const val DEFAULT_PHYSICAL_URL = "http://127.0.0.1:4000/"

    @Volatile
    private var currentBaseUrl: String = DEFAULT_EMULATOR_URL

    @Volatile
    private var retrofitInstance: Retrofit? = null

    @Volatile
    private var apiInstance: CampusPrintApi? = null

    fun getBaseUrl(): String = currentBaseUrl

    fun setBaseUrl(url: String) {
        val normalized = if (!url.endsWith("/")) "$url/" else url
        if (currentBaseUrl != normalized) {
            currentBaseUrl = normalized
            retrofitInstance = null
            apiInstance = null
        }
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

