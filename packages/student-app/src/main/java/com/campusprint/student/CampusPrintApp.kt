package com.campusprint.student

import android.app.Application
import com.campusprint.student.data.api.ApiClient
import com.campusprint.student.data.repository.CenterRepository
import com.campusprint.student.data.repository.OrderHistoryRepository

class CampusPrintApp : Application() {
    override fun onCreate() {
        super.onCreate()
        instance = this
        ApiClient.initialize(this)
        CenterRepository.initialize(this)
        OrderHistoryRepository.initialize(this)
    }

    companion object {
        lateinit var instance: CampusPrintApp
            private set
    }
}

