package com.campusprint.student.ui.upload

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.campusprint.student.data.model.PrintCenter
import com.campusprint.student.data.repository.CenterRepository
import com.campusprint.student.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun UploadScreen(
    onNavigateToConfigure: (documentId: String, fileName: String, pageCount: Int, fileSizeBytes: Long) -> Unit,
    viewModel: UploadViewModel = viewModel()
) {
    val context = LocalContext.current
    val uiState by viewModel.uiState.collectAsState()
    val selectedCenter by CenterRepository.selectedCenter.collectAsState()
    val availableCenters by CenterRepository.availableCenters.collectAsState()
    var showCenterDialog by remember { mutableStateOf(false) }
    var showQrDialog by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        CenterRepository.refreshCenters()
    }

    val pdfPickerLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.GetContent()
    ) { uri ->
        if (uri != null) {
            viewModel.onFileSelected(context, uri)
        }
    }

    LaunchedEffect(uiState) {
        if (uiState is UploadUiState.Success) {
            val data = (uiState as UploadUiState.Success).documentData
            onNavigateToConfigure(data.documentId, data.fileName, data.pageCount, data.fileSizeBytes)
            viewModel.resetState()
        }
    }

    Scaffold(
        containerColor = BackgroundDark,
        topBar = {
            TopAppBar(
                title = {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Box(
                            modifier = Modifier
                                .size(36.dp)
                                .clip(RoundedCornerShape(10.dp))
                                .background(BrandPrimary.copy(alpha = 0.15f))
                                .border(1.dp, BrandPrimary.copy(alpha = 0.4f), RoundedCornerShape(10.dp)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.Print,
                                contentDescription = "Print Logo",
                                tint = BrandAccent,
                                modifier = Modifier.size(20.dp)
                            )
                        }
                        Column {
                            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                Text(
                                    text = "CampusPrint",
                                    style = MaterialTheme.typography.titleMedium.copy(
                                        color = TextPrimary,
                                        fontWeight = FontWeight.Bold
                                    )
                                )
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(6.dp))
                                        .background(BrandPrimary.copy(alpha = 0.2f))
                                        .padding(horizontal = 6.dp, vertical = 2.dp)
                                ) {
                                    Text(
                                        text = "STUDENT",
                                        style = MaterialTheme.typography.labelSmall.copy(
                                            color = BrandAccent,
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 9.sp
                                        )
                                    )
                                }
                            }
                            Text(
                                text = "Zero-Queue Xerox Terminal",
                                style = MaterialTheme.typography.bodySmall.copy(color = TextSecondary, fontSize = 11.sp)
                            )
                        }
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = BackgroundDark)
            )
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
                .padding(horizontal = 20.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.SpaceBetween
        ) {
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                // Shop / Print Station Selector Banner
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(18.dp))
                        .background(SurfaceDark)
                        .border(1.dp, SurfaceBorder, RoundedCornerShape(18.dp))
                        .padding(14.dp)
                ) {
                    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                modifier = Modifier.weight(1f)
                            ) {
                                Box(
                                    modifier = Modifier
                                        .size(32.dp)
                                        .clip(RoundedCornerShape(8.dp))
                                        .background(BrandPrimary.copy(alpha = 0.2f)),
                                    contentAlignment = Alignment.Center
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.Storefront,
                                        contentDescription = null,
                                        tint = BrandAccent,
                                        modifier = Modifier.size(18.dp)
                                    )
                                }
                                Column {
                                    Text(
                                        text = selectedCenter.name,
                                        style = MaterialTheme.typography.titleSmall.copy(
                                            color = TextPrimary,
                                            fontWeight = FontWeight.Bold
                                        ),
                                        maxLines = 1
                                    )
                                    Row(
                                        verticalAlignment = Alignment.CenterVertically,
                                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                                    ) {
                                        Text(
                                            text = selectedCenter.code,
                                            style = MaterialTheme.typography.labelSmall.copy(
                                                color = TextMuted,
                                                fontFamily = FontFamily.Monospace,
                                                fontSize = 10.sp
                                            )
                                        )
                                        Text(text = "•", color = TextMuted, fontSize = 10.sp)
                                        Text(
                                            text = if (selectedCenter.isOpen) "● OPEN" else "● CLOSED",
                                            style = MaterialTheme.typography.labelSmall.copy(
                                                color = if (selectedCenter.isOpen) StatusGreen else StatusRed,
                                                fontWeight = FontWeight.Bold,
                                                fontSize = 10.sp
                                            )
                                        )
                                    }
                                }
                            }

                            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                                IconButton(
                                    onClick = { showQrDialog = true },
                                    modifier = Modifier.size(36.dp)
                                ) {
                                    Icon(
                                        imageVector = Icons.Default.QrCodeScanner,
                                        contentDescription = "Scan QR",
                                        tint = BrandAccent,
                                        modifier = Modifier.size(20.dp)
                                    )
                                }
                                OutlinedButton(
                                    onClick = { showCenterDialog = true },
                                    contentPadding = PaddingValues(horizontal = 10.dp, vertical = 0.dp),
                                    modifier = Modifier.height(34.dp),
                                    shape = RoundedCornerShape(10.dp),
                                    border = androidx.compose.foundation.BorderStroke(1.dp, SurfaceBorder)
                                ) {
                                    Text("Switch", fontSize = 11.sp, color = TextPrimary)
                                }
                            }
                        }

                        // Closed warning if applicable
                        if (!selectedCenter.isOpen) {
                            Box(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clip(RoundedCornerShape(8.dp))
                                    .background(StatusAmber.copy(alpha = 0.12f))
                                    .padding(horizontal = 10.dp, vertical = 6.dp)
                            ) {
                                Text(
                                    text = "⚠️ This center is currently closed. Incoming print jobs will queue until reopened.",
                                    style = MaterialTheme.typography.bodySmall.copy(
                                        color = StatusAmber,
                                        fontSize = 11.sp
                                    )
                                )
                            }
                        }

                        // Rates Chip Bar
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(6.dp))
                                    .background(SurfaceCard)
                                    .padding(horizontal = 8.dp, vertical = 3.dp)
                            ) {
                                Text(
                                    text = "B/W: ₹${String.format("%.2f", selectedCenter.bwRatePerSheet)}/sheet",
                                    style = MaterialTheme.typography.labelSmall.copy(
                                        color = TextSecondary,
                                        fontSize = 10.sp
                                    )
                                )
                            }
                            Box(
                                modifier = Modifier
                                    .clip(RoundedCornerShape(6.dp))
                                    .background(SurfaceCard)
                                    .padding(horizontal = 8.dp, vertical = 3.dp)
                            ) {
                                Text(
                                    text = "Color: ₹${String.format("%.2f", selectedCenter.colorRatePerSheet)}/sheet",
                                    style = MaterialTheme.typography.labelSmall.copy(
                                        color = TextSecondary,
                                        fontSize = 10.sp
                                    )
                                )
                            }
                        }
                    }
                }

                // Intro Card
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(20.dp))
                        .background(
                            Brush.linearGradient(
                                colors = listOf(SurfaceDark, SurfaceCard)
                            )
                        )
                        .border(1.dp, SurfaceBorder, RoundedCornerShape(20.dp))
                        .padding(18.dp)
                ) {
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.FlashOn,
                                contentDescription = null,
                                tint = BrandAccent,
                                modifier = Modifier.size(16.dp)
                            )
                            Text(
                                text = "Direct-to-Hardware Printing",
                                style = MaterialTheme.typography.labelMedium.copy(
                                    color = BrandAccent,
                                    fontWeight = FontWeight.SemiBold
                                )
                            )
                        }
                        Text(
                            text = "Upload PDF & Skip the Line",
                            style = MaterialTheme.typography.headlineMedium.copy(
                                color = TextPrimary,
                                fontWeight = FontWeight.ExtraBold
                            )
                        )
                        Text(
                            text = "Select any study material, assignments, or slides. Customize color, paper size, and duplex options with instant UPI checkout.",
                            style = MaterialTheme.typography.bodyMedium.copy(
                                color = TextSecondary,
                                lineHeight = 19.sp
                            )
                        )
                    }
                }

                // File Upload Drop Area
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(22.dp))
                        .background(SurfaceDark)
                        .border(
                            width = 1.5.dp,
                            color = if (uiState is UploadUiState.FileSelected) BrandPrimary else SurfaceBorder,
                            shape = RoundedCornerShape(22.dp)
                        )
                        .clickable {
                            if (uiState !is UploadUiState.Uploading) {
                                pdfPickerLauncher.launch("application/pdf")
                            }
                        }
                        .padding(24.dp),
                    contentAlignment = Alignment.Center
                ) {
                    Column(
                        horizontalAlignment = Alignment.CenterHorizontally,
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(56.dp)
                                .clip(RoundedCornerShape(16.dp))
                                .background(BrandPrimary.copy(alpha = 0.15f))
                                .border(1.dp, BrandPrimary.copy(alpha = 0.3f), RoundedCornerShape(16.dp)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.UploadFile,
                                contentDescription = "Upload",
                                tint = BrandAccent,
                                modifier = Modifier.size(30.dp)
                            )
                        }

                        when (val state = uiState) {
                            is UploadUiState.Idle -> {
                                Text(
                                    text = "Choose PDF Document",
                                    style = MaterialTheme.typography.titleMedium.copy(
                                        color = TextPrimary,
                                        fontWeight = FontWeight.Bold
                                    )
                                )
                                Text(
                                    text = "Tap to browse internal storage (Max 50 MB)",
                                    style = MaterialTheme.typography.bodySmall.copy(color = TextSecondary),
                                    textAlign = TextAlign.Center
                                )
                            }
                            is UploadUiState.FileSelected -> {
                                Text(
                                    text = state.fileName,
                                    style = MaterialTheme.typography.titleMedium.copy(
                                        color = TextPrimary,
                                        fontWeight = FontWeight.Bold
                                    ),
                                    textAlign = TextAlign.Center
                                )
                                val sizeFormatted = formatFileSize(state.fileSizeBytes)
                                Box(
                                    modifier = Modifier
                                        .clip(RoundedCornerShape(8.dp))
                                        .background(SurfaceCard)
                                        .padding(horizontal = 10.dp, vertical = 4.dp)
                                ) {
                                    Text(
                                        text = "$sizeFormatted • Ready to inspect",
                                        style = MaterialTheme.typography.bodySmall.copy(
                                            color = BrandAccent,
                                            fontFamily = FontFamily.Monospace,
                                            fontWeight = FontWeight.Medium
                                        )
                                    )
                                }
                            }
                            is UploadUiState.Uploading -> {
                                Text(
                                    text = "Analyzing & Uploading...",
                                    style = MaterialTheme.typography.titleMedium.copy(
                                        color = TextPrimary,
                                        fontWeight = FontWeight.Bold
                                    )
                                )
                                Text(
                                    text = state.fileName,
                                    style = MaterialTheme.typography.bodySmall.copy(color = TextSecondary),
                                    textAlign = TextAlign.Center
                                )
                                LinearProgressIndicator(
                                    progress = state.progress,
                                    modifier = Modifier
                                        .fillMaxWidth(0.8f)
                                        .height(6.dp)
                                        .clip(RoundedCornerShape(4.dp)),
                                    color = BrandPrimary,
                                    trackColor = SurfaceBorder
                                )
                            }
                            is UploadUiState.Error -> {
                                Text(
                                    text = "Upload Failed",
                                    style = MaterialTheme.typography.titleMedium.copy(
                                        color = StatusRed,
                                        fontWeight = FontWeight.Bold
                                    )
                                )
                                Text(
                                    text = state.message,
                                    style = MaterialTheme.typography.bodySmall.copy(color = TextSecondary),
                                    textAlign = TextAlign.Center
                                )
                            }
                            is UploadUiState.Success -> {
                                Text(
                                    text = "File Uploaded Successfully!",
                                    style = MaterialTheme.typography.titleMedium.copy(
                                        color = StatusGreen,
                                        fontWeight = FontWeight.Bold
                                    )
                                )
                            }
                        }
                    }
                }

                // Error Banner
                AnimatedVisibility(visible = uiState is UploadUiState.Error) {
                    val errorMsg = (uiState as? UploadUiState.Error)?.message ?: ""
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(14.dp))
                            .background(StatusRed.copy(alpha = 0.1f))
                            .border(1.dp, StatusRed.copy(alpha = 0.3f), RoundedCornerShape(14.dp))
                            .padding(14.dp)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(8.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Warning,
                                contentDescription = null,
                                tint = StatusRed,
                                modifier = Modifier.size(18.dp)
                            )
                            Text(
                                text = errorMsg,
                                style = MaterialTheme.typography.bodySmall.copy(color = StatusRed)
                            )
                        }
                    }
                }
            }

            // Bottom Actions & Guarantees
            Column(
                modifier = Modifier.fillMaxWidth(),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                // Security / Feature badges
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceEvenly
                ) {
                    FeatureBadge(icon = Icons.Default.Security, text = "SHA-256 Verified")
                    FeatureBadge(icon = Icons.Default.Speed, text = "Sub-second Queue")
                    FeatureBadge(icon = Icons.Default.Pin, text = "4-Digit OTP")
                }

                Button(
                    onClick = {
                        if (uiState is UploadUiState.FileSelected) {
                            viewModel.uploadDocument(context)
                        } else {
                            pdfPickerLauncher.launch("application/pdf")
                        }
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(54.dp),
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = BrandPrimary),
                    enabled = uiState !is UploadUiState.Uploading
                ) {
                    if (uiState is UploadUiState.Uploading) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(20.dp),
                            color = Color.White,
                            strokeWidth = 2.dp
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(text = "Uploading to Campus Server...", color = Color.White)
                    } else if (uiState is UploadUiState.FileSelected) {
                        Text(
                            text = "Upload & Configure Print",
                            style = MaterialTheme.typography.labelLarge.copy(
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Icon(imageVector = Icons.Default.ArrowForward, contentDescription = null, tint = Color.White)
                    } else {
                        Text(
                            text = "Select PDF Document",
                            style = MaterialTheme.typography.labelLarge.copy(
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                        )
                    }
                }
            }
        }
    }

    if (showCenterDialog) {
        CenterSelectorDialog(
            centers = availableCenters,
            selectedCenterId = selectedCenter.id,
            onSelect = { center ->
                CenterRepository.selectCenter(center)
                showCenterDialog = false
            },
            onDismiss = { showCenterDialog = false }
        )
    }

    if (showQrDialog) {
        QrScannerDialog(
            onCodeScanned = { rawCode ->
                val matched = CenterRepository.selectFromQrCodeOrDeepLink(rawCode)
                showQrDialog = false
            },
            onDismiss = { showQrDialog = false }
        )
    }
}

@Composable
private fun FeatureBadge(icon: androidx.compose.ui.graphics.vector.ImageVector, text: String) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp)
    ) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            tint = TextMuted,
            modifier = Modifier.size(14.dp)
        )
        Text(
            text = text,
            style = MaterialTheme.typography.bodySmall.copy(color = TextMuted, fontSize = 11.sp)
        )
    }
}

private fun formatFileSize(bytes: Long): String {
    return when {
        bytes >= 1024 * 1024 -> String.format("%.2f MB", bytes / (1024.0 * 1024.0))
        bytes >= 1024 -> String.format("%.1f KB", bytes / 1024.0)
        else -> "$bytes B"
    }
}


@Composable
private fun CenterSelectorDialog(
    centers: List<PrintCenter>,
    selectedCenterId: String,
    onSelect: (PrintCenter) -> Unit,
    onDismiss: () -> Unit
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = SurfaceDark,
        title = {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.Store,
                    contentDescription = null,
                    tint = BrandAccent,
                    modifier = Modifier.size(20.dp)
                )
                Text(
                    text = "Select Print Station",
                    style = MaterialTheme.typography.titleMedium.copy(
                        color = TextPrimary,
                        fontWeight = FontWeight.Bold
                    )
                )
            }
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 4.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp)
            ) {
                Text(
                    text = "Choose your campus collection counter:",
                    style = MaterialTheme.typography.bodySmall.copy(color = TextSecondary)
                )

                centers.forEach { center ->
                    val isSelected = center.id == selectedCenterId
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(12.dp))
                            .background(if (isSelected) BrandPrimary.copy(alpha = 0.15f) else SurfaceCard)
                            .border(
                                width = 1.dp,
                                color = if (isSelected) BrandPrimary else SurfaceBorder,
                                shape = RoundedCornerShape(12.dp)
                            )
                            .clickable { onSelect(center) }
                            .padding(12.dp)
                    ) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.SpaceBetween
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    horizontalArrangement = Arrangement.spacedBy(6.dp)
                                ) {
                                    Text(
                                        text = center.name,
                                        style = MaterialTheme.typography.bodyMedium.copy(
                                            color = TextPrimary,
                                            fontWeight = FontWeight.SemiBold
                                        )
                                    )
                                    Text(
                                        text = if (center.isOpen) "● OPEN" else "● CLOSED",
                                        style = MaterialTheme.typography.labelSmall.copy(
                                            color = if (center.isOpen) StatusGreen else StatusRed,
                                            fontWeight = FontWeight.Bold,
                                            fontSize = 9.sp
                                        )
                                    )
                                }
                                Text(
                                    text = center.location,
                                    style = MaterialTheme.typography.bodySmall.copy(
                                        color = TextMuted,
                                        fontSize = 11.sp
                                    )
                                )
                                Text(
                                    text = "B/W: ₹${center.bwRatePerSheet} • Color: ₹${center.colorRatePerSheet}",
                                    style = MaterialTheme.typography.labelSmall.copy(
                                        color = BrandAccent,
                                        fontSize = 10.sp
                                    )
                                )
                            }
                            if (isSelected) {
                                Icon(
                                    imageVector = Icons.Default.CheckCircle,
                                    contentDescription = "Selected",
                                    tint = BrandAccent,
                                    modifier = Modifier.size(20.dp)
                                )
                            }
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) {
                Text("Close", color = TextSecondary)
            }
        }
    )
}

@Composable
private fun QrScannerDialog(
    onCodeScanned: (String) -> Unit,
    onDismiss: () -> Unit
) {
    var rawInput by remember { mutableStateOf("") }

    AlertDialog(
        onDismissRequest = onDismiss,
        containerColor = SurfaceDark,
        title = {
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                Icon(
                    imageVector = Icons.Default.QrCodeScanner,
                    contentDescription = null,
                    tint = BrandAccent,
                    modifier = Modifier.size(22.dp)
                )
                Text(
                    text = "Counter QR Deep Link",
                    style = MaterialTheme.typography.titleMedium.copy(
                        color = TextPrimary,
                        fontWeight = FontWeight.Bold
                    )
                )
            }
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(vertical = 4.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(
                    text = "Scan the QR standee on the counter with your camera, or paste/enter the station URL or code (e.g. CTR-CAMPUS-01):",
                    style = MaterialTheme.typography.bodySmall.copy(color = TextSecondary, lineHeight = 17.sp)
                )

                OutlinedTextField(
                    value = rawInput,
                    onValueChange = { rawInput = it },
                    placeholder = {
                        Text("Paste QR URL or enter code", color = TextSecondary.copy(alpha = 0.5f), fontSize = 12.sp)
                    },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(10.dp),
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = BrandPrimary,
                        unfocusedBorderColor = SurfaceBorder,
                        focusedTextColor = TextPrimary,
                        unfocusedTextColor = TextPrimary,
                        focusedContainerColor = SurfaceCard,
                        unfocusedContainerColor = SurfaceCard
                    )
                )

                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    FilterChip(
                        selected = rawInput == "CTR-CAMPUS-01",
                        onClick = { rawInput = "CTR-CAMPUS-01" },
                        label = { Text("CTR-CAMPUS-01", fontSize = 10.sp) }
                    )
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    if (rawInput.isNotBlank()) {
                        onCodeScanned(rawInput.trim())
                    }
                },
                colors = ButtonDefaults.buttonColors(containerColor = BrandPrimary),
                enabled = rawInput.isNotBlank()
            ) {
                Text("Select Station", color = Color.White)
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text("Cancel", color = TextSecondary)
            }
        }
    )
}
