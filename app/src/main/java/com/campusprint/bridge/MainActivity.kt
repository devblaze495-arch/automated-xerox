package com.campusprint.bridge

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.core.content.ContextCompat
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.campusprint.bridge.ui.components.BridgeTopAppBar
import com.campusprint.bridge.ui.navigation.Screen
import com.campusprint.bridge.ui.screens.connection.ConnectionScreen
import com.campusprint.bridge.ui.screens.connection.ConnectionViewModel
import com.campusprint.bridge.ui.screens.dashboard.DashboardScreen
import com.campusprint.bridge.ui.screens.dashboard.DashboardViewModel
import com.campusprint.bridge.ui.theme.CampusPrintBridgeTheme

class MainActivity : ComponentActivity() {

    private val connectionViewModel: ConnectionViewModel by viewModels()
    private val dashboardViewModel: DashboardViewModel by viewModels()

    // Notification permission launcher for Android 13+ (API 33)
    private val requestNotificationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { _ ->
        // Notification permission granted/denied
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Attach active Activity instance to PrintBridgeManager
        // Android's PrintManager strictly requires an Activity context to launch print dialogs
        (application as CampusPrintApp).container.printBridgeManager.attachActivity(this)

        checkNotificationPermission()

        setContent {
            CampusPrintBridgeTheme {
                val navController = rememberNavController()
                val navBackStackEntry by navController.currentBackStackEntryAsState()
                val currentRoute = navBackStackEntry?.destination?.route ?: Screen.Dashboard.route

                val connectionUiState by connectionViewModel.uiState.collectAsState()

                Scaffold(
                    topBar = {
                        BridgeTopAppBar(
                            connectionState = connectionUiState.connectionState,
                            currentRoute = currentRoute,
                            onNavigateToDashboard = {
                                if (currentRoute != Screen.Dashboard.route) {
                                    navController.navigate(Screen.Dashboard.route) {
                                        popUpTo(Screen.Dashboard.route) { inclusive = true }
                                    }
                                }
                            },
                            onNavigateToConnection = {
                                if (currentRoute != Screen.Connection.route) {
                                    navController.navigate(Screen.Connection.route)
                                }
                            }
                        )
                    },
                    modifier = Modifier.fillMaxSize()
                ) { innerPadding ->
                    NavHost(
                        navController = navController,
                        startDestination = Screen.Dashboard.route,
                        modifier = Modifier.padding(innerPadding)
                    ) {
                        composable(Screen.Dashboard.route) {
                            DashboardScreen(
                                viewModel = dashboardViewModel,
                                onNavigateToConnection = {
                                    navController.navigate(Screen.Connection.route)
                                }
                            )
                        }
                        composable(Screen.Connection.route) {
                            ConnectionScreen(
                                viewModel = connectionViewModel,
                                onNavigateToDashboard = {
                                    navController.navigate(Screen.Dashboard.route) {
                                        popUpTo(Screen.Dashboard.route) { inclusive = true }
                                    }
                                }
                            )
                        }
                    }
                }
            }
        }
    }

    override fun onResume() {
        super.onResume()
        // Re-attach active Activity when resumed to ensure PrintManager always has a valid foreground activity
        (application as CampusPrintApp).container.printBridgeManager.attachActivity(this)
    }

    override fun onDestroy() {
        super.onDestroy()
        (application as CampusPrintApp).container.printBridgeManager.detachActivity(this)
    }

    private fun checkNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val permission = Manifest.permission.POST_NOTIFICATIONS
            if (ContextCompat.checkSelfPermission(this, permission) != PackageManager.PERMISSION_GRANTED) {
                requestNotificationPermissionLauncher.launch(permission)
            }
        }
    }
}
