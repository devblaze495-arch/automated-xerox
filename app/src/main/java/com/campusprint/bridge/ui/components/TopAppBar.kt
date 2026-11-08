package com.campusprint.bridge.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Cable
import androidx.compose.material.icons.filled.Print
import androidx.compose.material.icons.filled.PrintDisabled
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.campusprint.bridge.data.model.ConnectionState
import com.campusprint.bridge.ui.theme.BrandPrimary
import com.campusprint.bridge.ui.theme.DarkBackground
import com.campusprint.bridge.ui.theme.DarkBorder
import com.campusprint.bridge.ui.theme.DarkSurface
import com.campusprint.bridge.ui.theme.TextPrimary
import com.campusprint.bridge.ui.theme.TextSecondary

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun BridgeTopAppBar(
    connectionState: ConnectionState,
    currentRoute: String,
    onNavigateToDashboard: () -> Unit,
    onNavigateToConnection: () -> Unit,
    modifier: Modifier = Modifier
) {
    TopAppBar(
        modifier = modifier
            .background(DarkBackground)
            .border(
                width = 1.dp,
                color = DarkBorder.copy(alpha = 0.5f),
                shape = RoundedCornerShape(bottomStart = 16.dp, bottomEnd = 16.dp)
            ),
        colors = TopAppBarDefaults.topAppBarColors(
            containerColor = DarkSurface
        ),
        title = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Box(
                    modifier = Modifier
                        .size(32.dp)
                        .background(BrandPrimary.copy(alpha = 0.15f), RoundedCornerShape(8.dp))
                        .border(1.dp, BrandPrimary.copy(alpha = 0.4f), RoundedCornerShape(8.dp)),
                    contentAlignment = Alignment.Center
                ) {
                    Icon(
                        imageVector = Icons.Default.Print,
                        contentDescription = null,
                        tint = BrandPrimary,
                        modifier = Modifier.size(18.dp)
                    )
                }
                Spacer(modifier = Modifier.width(10.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        text = "CampusPrint",
                        style = MaterialTheme.typography.titleLarge.copy(
                            fontWeight = FontWeight.Bold,
                            color = TextPrimary
                        )
                    )
                    Text(
                        text = "Bridge",
                        style = MaterialTheme.typography.titleLarge.copy(
                            fontWeight = FontWeight.Light,
                            color = BrandPrimary
                        )
                    )
                }
            }
        },
        actions = {
            ConnectionPill(
                connectionState = connectionState,
                onClick = onNavigateToConnection
            )
            Spacer(modifier = Modifier.width(8.dp))

            // Navigation icons
            if (currentRoute == "dashboard") {
                IconButton(onClick = onNavigateToConnection) {
                    Icon(
                        imageVector = Icons.Default.Cable,
                        contentDescription = "Terminal Settings",
                        tint = TextSecondary
                    )
                }
            } else {
                IconButton(onClick = onNavigateToDashboard) {
                    Icon(
                        imageVector = Icons.Default.Print,
                        contentDescription = "Print Queue",
                        tint = BrandPrimary
                    )
                }
            }
        }
    )
}

