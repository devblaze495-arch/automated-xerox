package com.campusprint.bridge.ui.screens.connection

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowForward
import androidx.compose.material.icons.filled.Business
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.CloudDownload
import androidx.compose.material.icons.filled.Error
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Key
import androidx.compose.material.icons.filled.Language
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.PowerSettingsNew
import androidx.compose.material.icons.filled.Print
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.campusprint.bridge.data.model.ConnectionState
import com.campusprint.bridge.data.model.PresetEndpoints
import com.campusprint.bridge.ui.theme.BrandPrimary
import com.campusprint.bridge.ui.theme.DarkBackground
import com.campusprint.bridge.ui.theme.DarkBorder
import com.campusprint.bridge.ui.theme.DarkSurface
import com.campusprint.bridge.ui.theme.DarkSurfaceCard
import com.campusprint.bridge.ui.theme.DarkSurfaceElevated
import com.campusprint.bridge.ui.theme.StatusAmber
import com.campusprint.bridge.ui.theme.StatusAmberBg
import com.campusprint.bridge.ui.theme.StatusGreen
import com.campusprint.bridge.ui.theme.StatusGreenBg
import com.campusprint.bridge.ui.theme.StatusRed
import com.campusprint.bridge.ui.theme.StatusRedBg
import com.campusprint.bridge.ui.theme.TextMuted
import com.campusprint.bridge.ui.theme.TextPrimary
import com.campusprint.bridge.ui.theme.TextSecondary

@OptIn(ExperimentalLayoutApi::class)
@Composable
fun ConnectionScreen(
    viewModel: ConnectionViewModel,
    onNavigateToDashboard: () -> Unit,
    modifier: Modifier = Modifier
) {
    val uiState by viewModel.uiState.collectAsState()
    val scrollState = rememberScrollState()
    val focusManager = LocalFocusManager.current

    val isConnected = uiState.connectionState is ConnectionState.Connected
    val isConnecting = uiState.connectionState is ConnectionState.Connecting

    Column(
        modifier = modifier
            .fillMaxSize()
            .background(DarkBackground)
            .verticalScroll(scrollState)
            .padding(20.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {

        // Header
        Column(
            modifier = Modifier.fillMaxWidth(),
            horizontalAlignment = Alignment.Start
        ) {
            Text(
                text = "Terminal Setup",
                style = MaterialTheme.typography.headlineMedium.copy(
                    fontWeight = FontWeight.Bold,
                    color = TextPrimary
                )
            )
            Spacer(modifier = Modifier.height(4.dp))
            Text(
                text = "Configure the persistent WebSocket bridge to receive incoming campus print orders.",
                style = MaterialTheme.typography.bodyMedium.copy(color = TextSecondary)
            )
        }

        Spacer(modifier = Modifier.height(20.dp))

        // Connection Status Banner Card
        StatusBannerCard(
            connectionState = uiState.connectionState,
            centerId = uiState.centerId
        )

        Spacer(modifier = Modifier.height(24.dp))

        // Server WebSocket URL Card
        SectionCard(title = "Server WebSocket Endpoint") {
            OutlinedTextField(
                value = uiState.serverUrl,
                onValueChange = { viewModel.onServerUrlChange(it) },
                label = { Text("WebSocket URL (ws:// or wss://)") },
                leadingIcon = {
                    Icon(
                        imageVector = Icons.Default.Language,
                        contentDescription = null,
                        tint = BrandPrimary
                    )
                },
                singleLine = true,
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Uri,
                    imeAction = ImeAction.Next
                ),
                colors = outlinedTextFieldColors(),
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(10.dp))

            Text(
                text = "Quick Presets:",
                style = MaterialTheme.typography.labelSmall.copy(color = TextMuted)
            )
            Spacer(modifier = Modifier.height(6.dp))

            FlowRow(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                PresetChip(
                    label = "Physical Phone USB [Default] (127.0.0.1:4000)",
                    onClick = { viewModel.applyPresetUrl(PresetEndpoints.USB_ADB_REVERSE) }
                )
                PresetChip(
                    label = "Android Emulator (10.0.2.2:4000)",
                    onClick = { viewModel.applyPresetUrl(PresetEndpoints.EMULATOR_LOOPBACK) }
                )
                PresetChip(
                    label = "Local LAN (192.168.1.100:4000)",
                    onClick = { viewModel.applyPresetUrl(PresetEndpoints.LAN_SAMPLE) }
                )
            }

            Spacer(modifier = Modifier.height(14.dp))

            // Physical Device USB ADB Reverse Helper Callout
            Surface(
                color = DarkSurfaceElevated,
                shape = RoundedCornerShape(10.dp),
                border = androidx.compose.foundation.BorderStroke(1.dp, BrandPrimary.copy(alpha = 0.35f)),
                modifier = Modifier.fillMaxWidth()
            ) {
                Row(
                    modifier = Modifier.padding(12.dp),
                    verticalAlignment = Alignment.Top
                ) {
                    Icon(
                        imageVector = Icons.Default.Info,
                        contentDescription = null,
                        tint = BrandPrimary,
                        modifier = Modifier
                            .size(20.dp)
                            .padding(top = 1.dp)
                    )
                    Spacer(modifier = Modifier.width(10.dp))
                    Column {
                        Text(
                            text = "Physical Device USB Testing",
                            style = MaterialTheme.typography.labelMedium.copy(
                                color = TextPrimary,
                                fontWeight = FontWeight.SemiBold
                            )
                        )
                        Spacer(modifier = Modifier.height(2.dp))
                        Text(
                            text = "When connecting via USB, route port 4000 traffic from your host computer to the phone by running:",
                            style = MaterialTheme.typography.bodySmall.copy(color = TextSecondary)
                        )
                        Spacer(modifier = Modifier.height(6.dp))
                        Surface(
                            color = DarkBackground,
                            shape = RoundedCornerShape(6.dp),
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text(
                                text = "adb reverse tcp:4000 tcp:4000",
                                style = MaterialTheme.typography.labelSmall.copy(
                                    color = BrandPrimary,
                                    fontFamily = FontFamily.Monospace,
                                    fontWeight = FontWeight.Bold
                                ),
                                modifier = Modifier.padding(horizontal = 10.dp, vertical = 6.dp)
                            )
                        }
                    }
                }
            }
        }

        Spacer(modifier = Modifier.height(20.dp))

        // Center Identification Card
        SectionCard(title = "Operator Credentials") {
            OutlinedTextField(
                value = uiState.centerId,
                onValueChange = { viewModel.onCenterIdChange(it) },
                label = { Text("Center ID / Shop Identifier") },
                leadingIcon = {
                    Icon(
                        imageVector = Icons.Default.Business,
                        contentDescription = null,
                        tint = BrandPrimary
                    )
                },
                placeholder = { Text("e.g. CTR-CAMPUS-01") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Text,
                    imeAction = ImeAction.Next
                ),
                colors = outlinedTextFieldColors(),
                modifier = Modifier.fillMaxWidth()
            )

            Spacer(modifier = Modifier.height(14.dp))

            OutlinedTextField(
                value = uiState.secretToken,
                onValueChange = { viewModel.onSecretTokenChange(it) },
                label = { Text("Agent Secret Token") },
                leadingIcon = {
                    Icon(
                        imageVector = Icons.Default.Key,
                        contentDescription = null,
                        tint = BrandPrimary
                    )
                },
                trailingIcon = {
                    IconButton(onClick = { viewModel.togglePasswordVisibility() }) {
                        Icon(
                            imageVector = if (uiState.isPasswordVisible) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                            contentDescription = if (uiState.isPasswordVisible) "Hide secret" else "Show secret",
                            tint = TextSecondary
                        )
                    }
                },
                visualTransformation = if (uiState.isPasswordVisible) VisualTransformation.None else PasswordVisualTransformation(),
                placeholder = { Text("Shared secret authentication token") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(
                    keyboardType = KeyboardType.Password,
                    imeAction = ImeAction.Done
                ),
                keyboardActions = KeyboardActions(
                    onDone = { focusManager.clearFocus() }
                ),
                colors = outlinedTextFieldColors(),
                modifier = Modifier.fillMaxWidth()
            )
        }

        Spacer(modifier = Modifier.height(20.dp))

        // Automated Workflow Settings Card
        SectionCard(title = "Terminal Workflow Automation") {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "Auto-download incoming PDFs",
                        style = MaterialTheme.typography.titleMedium.copy(color = TextPrimary)
                    )
                    Text(
                        text = "Immediately fetch and cache dispatched documents",
                        style = MaterialTheme.typography.bodySmall.copy(color = TextSecondary)
                    )
                }
                Switch(
                    checked = uiState.autoDownload,
                    onCheckedChange = { viewModel.onAutoDownloadChange(it) },
                    colors = SwitchDefaults.colors(
                        checkedThumbColor = Color.White,
                        checkedTrackColor = BrandPrimary,
                        uncheckedTrackColor = DarkSurfaceElevated
                    )
                )
            }

            Spacer(modifier = Modifier.height(12.dp))

            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Column(modifier = Modifier.weight(1f)) {
                    Text(
                        text = "Auto-launch system print dialog",
                        style = MaterialTheme.typography.titleMedium.copy(color = TextPrimary)
                    )
                    Text(
                        text = "Open Android Print Spooler dialog as soon as download completes",
                        style = MaterialTheme.typography.bodySmall.copy(color = TextSecondary)
                    )
                }
                Switch(
                    checked = uiState.autoPrint,
                    onCheckedChange = { viewModel.onAutoPrintChange(it) },
                    colors = SwitchDefaults.colors(
                        checkedThumbColor = Color.White,
                        checkedTrackColor = BrandPrimary,
                        uncheckedTrackColor = DarkSurfaceElevated
                    )
                )
            }
        }

        Spacer(modifier = Modifier.height(28.dp))

        // Primary Action: Connect / Disconnect Button
        Button(
            onClick = {
                focusManager.clearFocus()
                viewModel.toggleConnection()
            },
            modifier = Modifier
                .fillMaxWidth()
                .height(54.dp),
            shape = RoundedCornerShape(12.dp),
            colors = ButtonDefaults.buttonColors(
                containerColor = if (isConnected || isConnecting) StatusRed else BrandPrimary
            )
        ) {
            if (isConnecting) {
                CircularProgressIndicator(
                    color = Color.White,
                    strokeWidth = 2.5.dp,
                    modifier = Modifier.size(20.dp)
                )
                Spacer(modifier = Modifier.width(10.dp))
                Text(
                    text = "Connecting to Server...",
                    style = MaterialTheme.typography.labelLarge.copy(color = Color.White)
                )
            } else if (isConnected) {
                Icon(
                    imageVector = Icons.Default.PowerSettingsNew,
                    contentDescription = null,
                    tint = Color.White,
                    modifier = Modifier.size(20.dp)
                )
                Spacer(modifier = Modifier.width(10.dp))
                Text(
                    text = "Disconnect Terminal",
                    style = MaterialTheme.typography.labelLarge.copy(color = Color.White)
                )
            } else {
                Icon(
                    imageVector = Icons.Default.PowerSettingsNew,
                    contentDescription = null,
                    tint = Color.White,
                    modifier = Modifier.size(20.dp)
                )
                Spacer(modifier = Modifier.width(10.dp))
                Text(
                    text = "Connect to Print Server",
                    style = MaterialTheme.typography.labelLarge.copy(color = Color.White)
                )
            }
        }

        Spacer(modifier = Modifier.height(14.dp))

        // Quick Link to Dashboard
        OutlinedButton(
            onClick = onNavigateToDashboard,
            modifier = Modifier
                .fillMaxWidth()
                .height(48.dp),
            shape = RoundedCornerShape(12.dp),
            border = androidx.compose.foundation.BorderStroke(1.dp, DarkBorder),
            colors = ButtonDefaults.outlinedButtonColors(
                contentColor = TextPrimary
            )
        ) {
            Icon(
                imageVector = Icons.Default.Print,
                contentDescription = null,
                tint = BrandPrimary,
                modifier = Modifier.size(18.dp)
            )
            Spacer(modifier = Modifier.width(8.dp))
            Text(
                text = "Open Active Print Queue",
                style = MaterialTheme.typography.labelLarge
            )
            Spacer(modifier = Modifier.weight(1f))
            Icon(
                imageVector = Icons.AutoMirrored.Filled.ArrowForward,
                contentDescription = null,
                tint = TextSecondary,
                modifier = Modifier.size(16.dp)
            )
        }

        Spacer(modifier = Modifier.height(24.dp))

        // Terminal Statistics Card
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .background(DarkSurface, RoundedCornerShape(12.dp))
                .border(1.dp, DarkBorder, RoundedCornerShape(12.dp))
                .padding(16.dp),
            horizontalArrangement = Arrangement.SpaceAround
        ) {
            StatItem(title = "Jobs Dispatched", value = uiState.totalReceived.toString())
            StatItem(title = "Jobs Completed", value = uiState.totalCompleted.toString())
            StatItem(
                title = "Terminal Mode",
                value = if (isConnected) "ONLINE" else "STANDBY"
            )
        }

        Spacer(modifier = Modifier.height(24.dp))
    }
}

@Composable
private fun StatusBannerCard(
    connectionState: ConnectionState,
    centerId: String
) {
    val (statusTitle, statusDetail, icon, fgColor, bgColor) = when (connectionState) {
        is ConnectionState.Connected -> Quintuple(
            "BRIDGE CONNECTED",
            "Active session registered for $centerId (${connectionState.url})",
            Icons.Default.CheckCircle,
            StatusGreen,
            StatusGreenBg
        )
        is ConnectionState.Connecting -> Quintuple(
            "CONNECTING TO GATEWAY",
            "Establishing handshake at ${connectionState.url}...",
            Icons.Default.Refresh,
            StatusAmber,
            StatusAmberBg
        )
        is ConnectionState.Disconnected -> Quintuple(
            "OFFLINE / DISCONNECTED",
            connectionState.reason ?: "Terminal is currently idle. Press Connect to start listening for print orders.",
            Icons.Default.PowerSettingsNew,
            TextMuted,
            Color(0xFF161A24)
        )
        is ConnectionState.Error -> Quintuple(
            "CONNECTION ERROR",
            connectionState.message,
            Icons.Default.Error,
            StatusRed,
            StatusRedBg
        )
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(14.dp))
            .background(bgColor)
            .border(1.dp, fgColor.copy(alpha = 0.4f), RoundedCornerShape(14.dp))
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(42.dp)
                .background(fgColor.copy(alpha = 0.2f), CircleShape),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = fgColor,
                modifier = Modifier.size(24.dp)
            )
        }
        Spacer(modifier = Modifier.width(14.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = statusTitle,
                color = fgColor,
                fontSize = 13.sp,
                fontWeight = FontWeight.Bold,
                fontFamily = FontFamily.Monospace,
                letterSpacing = 0.5.sp
            )
            Spacer(modifier = Modifier.height(3.dp))
            Text(
                text = statusDetail,
                color = TextSecondary,
                fontSize = 12.sp,
                lineHeight = 16.sp
            )
        }
    }
}

@Composable
private fun SectionCard(
    title: String,
    content: @Composable () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(DarkSurfaceCard, RoundedCornerShape(14.dp))
            .border(1.dp, DarkBorder, RoundedCornerShape(14.dp))
            .padding(18.dp)
    ) {
        Text(
            text = title,
            style = MaterialTheme.typography.titleMedium.copy(
                fontWeight = FontWeight.SemiBold,
                color = TextPrimary
            )
        )
        Spacer(modifier = Modifier.height(14.dp))
        content()
    }
}

@Composable
private fun PresetChip(
    label: String,
    onClick: () -> Unit
) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(8.dp))
            .background(DarkSurfaceElevated)
            .border(1.dp, DarkBorder, RoundedCornerShape(8.dp))
            .clickable { onClick() }
            .padding(horizontal = 10.dp, vertical = 6.dp)
    ) {
        Text(
            text = label,
            color = TextSecondary,
            fontSize = 11.sp,
            fontFamily = FontFamily.Monospace
        )
    }
}

@Composable
private fun StatItem(title: String, value: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = value,
            style = MaterialTheme.typography.headlineSmall.copy(
                fontWeight = FontWeight.Bold,
                color = BrandPrimary
            )
        )
        Spacer(modifier = Modifier.height(2.dp))
        Text(
            text = title,
            style = MaterialTheme.typography.labelSmall.copy(color = TextSecondary)
        )
    }
}

@Composable
private fun outlinedTextFieldColors() = OutlinedTextFieldDefaults.colors(
    focusedBorderColor = BrandPrimary,
    unfocusedBorderColor = DarkBorder,
    focusedLabelColor = BrandPrimary,
    unfocusedLabelColor = TextSecondary,
    focusedTextColor = TextPrimary,
    unfocusedTextColor = TextPrimary,
    cursorColor = BrandPrimary,
    focusedContainerColor = DarkSurface,
    unfocusedContainerColor = DarkSurface
)

data class Quintuple<A, B, C, D, E>(
    val first: A,
    val second: B,
    val third: C,
    val fourth: D,
    val fifth: E
)

