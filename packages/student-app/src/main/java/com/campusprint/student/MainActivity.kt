package com.campusprint.student

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import com.campusprint.student.data.repository.CenterRepository
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Dns
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.navigation.compose.rememberNavController
import com.campusprint.student.data.api.ApiClient
import com.campusprint.student.ui.navigation.AppNavHost
import com.campusprint.student.ui.theme.BackgroundDark
import com.campusprint.student.ui.theme.BrandAccent
import com.campusprint.student.ui.theme.BrandPrimary
import com.campusprint.student.ui.theme.CampusPrintTheme
import com.campusprint.student.ui.theme.SurfaceBorder
import com.campusprint.student.ui.theme.SurfaceCard
import com.campusprint.student.ui.theme.SurfaceDark
import com.campusprint.student.ui.theme.TextPrimary
import com.campusprint.student.ui.theme.TextSecondary

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        handleDeepLink(intent)
        setContent {
            CampusPrintTheme {
                val navController = rememberNavController()
                var showServerConfigDialog by remember { mutableStateOf(false) }

                Box(modifier = Modifier.fillMaxSize()) {
                    AppNavHost(navController = navController)

                    // Small Server URL Settings Pill at bottom right of the screen
                    FloatingActionButton(
                        onClick = { showServerConfigDialog = true },
                        modifier = Modifier
                            .align(Alignment.BottomEnd)
                            .padding(bottom = 80.dp, end = 16.dp)
                            .size(42.dp),
                        shape = CircleShape,
                        containerColor = SurfaceCard,
                        contentColor = BrandAccent,
                        elevation = FloatingActionButtonDefaults.elevation(defaultElevation = 4.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Dns,
                            contentDescription = "Backend API Config",
                            modifier = Modifier.size(20.dp)
                        )
                    }

                    if (showServerConfigDialog) {
                        ServerConfigDialog(
                            currentUrl = ApiClient.getBaseUrl(),
                            onDismiss = { showServerConfigDialog = false },
                            onSave = { newUrl ->
                                ApiClient.setBaseUrl(newUrl)
                                showServerConfigDialog = false
                            }
                        )
                    }
                }
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

@Composable
private fun ServerConfigDialog(
    currentUrl: String,
    onDismiss: () -> Unit,
    onSave: (String) -> Unit
) {
    var urlText by remember { mutableStateOf(currentUrl) }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = SurfaceDark,
        titleContentColor = TextPrimary,
        textContentColor = TextSecondary,
        title = {
            Text(text = "Configure Backend Gateway")
        },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    text = "Select or enter the Fastify API Gateway URL:",
                    style = MaterialTheme.typography.bodySmall.copy(color = TextSecondary)
                )

                OutlinedTextField(
                    value = urlText,
                    onValueChange = { urlText = it },
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = BrandPrimary,
                        unfocusedBorderColor = SurfaceBorder,
                        focusedTextColor = TextPrimary,
                        unfocusedTextColor = TextPrimary
                    ),
                    modifier = Modifier.fillMaxWidth()
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    FilterChip(
                        selected = urlText.contains("10.0.2.2"),
                        onClick = { urlText = "http://10.0.2.2:4000/" },
                        label = { Text("Emulator (10.0.2.2)", fontSize = 11.sp) }
                    )
                    FilterChip(
                        selected = urlText.contains("127.0.0.1"),
                        onClick = { urlText = "http://127.0.0.1:4000/" },
                        label = { Text("ADB Reverse (127.0.0.1)", fontSize = 11.sp) }
                    )
                }
            }
        },
        confirmButton = {
            Button(
                onClick = { onSave(urlText) },
                colors = ButtonDefaults.buttonColors(containerColor = BrandPrimary)
            ) {
                Text("Save", color = Color.White)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel", color = TextSecondary)
            }
        }
    )
}

