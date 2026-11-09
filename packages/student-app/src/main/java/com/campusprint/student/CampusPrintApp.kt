package com.campusprint.student

import android.app.Application

class CampusPrintApp : Application() {
    override fun onCreate() {
        super.onCreate()
        instance = this
    }

    companion object {
        lateinit var instance: CampusPrintApp
            private set
    }
}

