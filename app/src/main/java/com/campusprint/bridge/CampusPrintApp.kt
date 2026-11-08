package com.campusprint.bridge

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import com.campusprint.bridge.data.local.PreferencesRepository
import com.campusprint.bridge.data.remote.DocumentDownloader
import com.campusprint.bridge.data.remote.WebSocketManager
import com.campusprint.bridge.service.PrintBridgeForegroundService
import com.campusprint.bridge.service.PrintBridgeManager

/**
 * Dependency container providing app-wide singleton services.
 */
class AppContainer(private val applicationContext: Context) {
    val preferencesRepository: PreferencesRepository by lazy {
        PreferencesRepository(applicationContext)
    }

    val webSocketManager: WebSocketManager by lazy {
        WebSocketManager()
    }

    val documentDownloader: DocumentDownloader by lazy {
        DocumentDownloader(applicationContext)
    }

    val printBridgeManager: PrintBridgeManager by lazy {
        PrintBridgeManager(applicationContext)
    }
}

/**
 * Main application class initializing the DI container and system channels.
 */
class CampusPrintApp : Application() {

    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        container = AppContainer(applicationContext)
        createNotificationChannels()
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                PrintBridgeForegroundService.CHANNEL_ID,
                getString(R.string.channel_name),
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = getString(R.string.channel_description)
                setShowBadge(false)
            }
            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(channel)
        }
    }
}

