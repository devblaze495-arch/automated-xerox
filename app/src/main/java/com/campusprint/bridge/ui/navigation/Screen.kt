package com.campusprint.bridge.ui.navigation

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Cable
import androidx.compose.material.icons.filled.Print
import androidx.compose.ui.graphics.vector.ImageVector

/**
 * Top-level destination routes for the companion terminal app.
 */
sealed class Screen(
    val route: String,
    val title: String,
    val icon: ImageVector
) {
    data object Dashboard : Screen(
        route = "dashboard",
        title = "Print Queue",
        icon = Icons.Default.Print
    )

    data object Connection : Screen(
        route = "connection",
        title = "Terminal Setup",
        icon = Icons.Default.Cable
    )
}

