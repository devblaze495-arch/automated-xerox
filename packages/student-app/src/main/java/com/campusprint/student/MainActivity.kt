package com.campusprint.student

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.navigation.compose.rememberNavController
import com.campusprint.student.data.repository.CenterRepository
import com.campusprint.student.ui.navigation.AppNavHost
import com.campusprint.student.ui.theme.CampusPrintTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        handleDeepLink(intent)
        setContent {
            CampusPrintTheme {
                val navController = rememberNavController()
                AppNavHost(navController = navController)
            }
        }
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        handleDeepLink(intent)
    }

    private fun handleDeepLink(intent: Intent?) {
        val dataUri = intent?.data ?: return
        CenterRepository.selectFromQrCodeOrDeepLink(dataUri.toString())
    }
}
