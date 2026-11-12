package com.campusprint.student

import android.app.Application
import com.campusprint.student.data.repository.CenterRepository

class CampusPrintApp : Application() {
    override fun onCreate() {
        super.onCreate()
        instance = this
        CenterRepository.initialize(this)
    }

    companion object {
        lateinit var instance: CampusPrintApp
            private set
    }
}

