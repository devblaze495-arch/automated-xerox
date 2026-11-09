package com.campusprint.student.ui.configure

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.campusprint.student.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ConfigureJobScreen(
    documentId: String,
    fileName: String,
    pageCount: Int,
    fileSizeBytes: Long,
    onNavigateBack: () -> Unit,
    onProceedToCheckout: (
        documentId: String,
        fileName: String,
        pageCount: Int,
        colorMode: String,
        duplexMode: String,
        paperSize: String,
        copies: Int,
        totalSheets: Int,
        itemTotalCents: Long
    ) -> Unit,
    viewModel: ConfigureViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(documentId) {
        viewModel.initialize(documentId, fileName, pageCount, fileSizeBytes)
    }

    Scaffold(
        containerColor = BackgroundDark,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "Configure Print Job",
                        style = MaterialTheme.typography.titleMedium.copy(
                            color = TextPrimary,
                            fontWeight = FontWeight.Bold
                        )
                    )
                },
                navigationIcon = {
                    IconButton(onClick = onNavigateBack) {
                        Icon(
                            imageVector = Icons.Default.ArrowBack,
                            contentDescription = "Back",
                            tint = TextPrimary
                        )
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
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            // Document Summary Banner
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(18.dp))
                    .background(SurfaceDark)
                    .border(1.dp, SurfaceBorder, RoundedCornerShape(18.dp))
                    .padding(16.dp)
            ) {
                Row(
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(12.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .size(46.dp)
                            .clip(RoundedCornerShape(12.dp))
                            .background(BrandPrimary.copy(alpha = 0.15f)),
                        contentAlignment = Alignment.Center
                    ) {
                        Icon(
                            imageVector = Icons.Default.Description,
                            contentDescription = null,
                            tint = BrandAccent,
                            modifier = Modifier.size(24.dp)
                        )
                    }
                    Column(modifier = Modifier.weight(1f)) {
                        Text(
                            text = uiState.fileName.ifEmpty { fileName },
                            style = MaterialTheme.typography.titleSmall.copy(
                                color = TextPrimary,
                                fontWeight = FontWeight.Bold
                            ),
                            maxLines = 1
                        )
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(8.dp),
                            modifier = Modifier.padding(top = 4.dp)
                        ) {
                            Text(
                                text = "${uiState.pageCount} Pages",
                                style = MaterialTheme.typography.bodySmall.copy(
                                    color = BrandAccent,
                                    fontFamily = FontFamily.Monospace,
                                    fontWeight = FontWeight.SemiBold
                                )
                            )
                            Text(
                                text = "•",
                                style = MaterialTheme.typography.bodySmall.copy(color = TextMuted)
                            )
                            Text(
                                text = formatBytes(fileSizeBytes),
                                style = MaterialTheme.typography.bodySmall.copy(color = TextSecondary)
                            )
                        }
                    }
                }
            }

            // Option 1: Color Mode
            SectionCard(title = "Color Mode", icon = Icons.Default.Palette) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    SelectableOptionCard(
                        title = "Black & White",
                        subtitle = "Standard text & notes",
                        isSelected = uiState.colorMode == "BW",
                        modifier = Modifier.weight(1f),
                        onClick = { viewModel.setColorMode("BW") }
                    )
                    SelectableOptionCard(
                        title = "Full Color",
                        subtitle = "Charts & graphics",
                        isSelected = uiState.colorMode == "COLOR",
                        modifier = Modifier.weight(1f),
                        onClick = { viewModel.setColorMode("COLOR") }
                    )
                }
            }

            // Option 2: Duplex Mode
            SectionCard(title = "Print Sides", icon = Icons.Default.Flip) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    SelectableOptionCard(
                        title = "Single-Sided",
                        subtitle = "Simplex (1 sheet/page)",
                        isSelected = uiState.duplexMode == "SIMPLEX",
                        modifier = Modifier.weight(1f),
                        onClick = { viewModel.setDuplexMode("SIMPLEX") }
                    )
                    SelectableOptionCard(
                        title = "Double-Sided",
                        subtitle = "Duplex Long Edge",
                        isSelected = uiState.duplexMode == "DUPLEX_LONG",
                        modifier = Modifier.weight(1f),
                        onClick = { viewModel.setDuplexMode("DUPLEX_LONG") }
                    )
                }
            }

            // Option 3: Paper Size
            SectionCard(title = "Paper Size", icon = Icons.Default.AspectRatio) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    SelectableOptionCard(
                        title = "A4 Standard",
                        subtitle = "210 × 297 mm",
                        isSelected = uiState.paperSize == "A4",
                        modifier = Modifier.weight(1f),
                        onClick = { viewModel.setPaperSize("A4") }
                    )
                    SelectableOptionCard(
                        title = "A3 Poster",
                        subtitle = "297 × 420 mm",
                        isSelected = uiState.paperSize == "A3",
                        modifier = Modifier.weight(1f),
                        onClick = { viewModel.setPaperSize("A3") }
                    )
                }
            }

            // Option 4: Copies Stepper
            SectionCard(title = "Copies", icon = Icons.Default.ContentCopy) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(SurfaceDark)
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Text(
                        text = "Number of sets",
                        style = MaterialTheme.typography.bodyMedium.copy(color = TextSecondary)
                    )

                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        IconButton(
                            onClick = { viewModel.decrementCopies() },
                            modifier = Modifier
                                .size(36.dp)
                                .clip(RoundedCornerShape(10.dp))
                                .background(SurfaceCard)
                                .border(1.dp, SurfaceBorder, RoundedCornerShape(10.dp)),
                            enabled = uiState.copies > 1
                        ) {
                            Icon(
                                imageVector = Icons.Default.Remove,
                                contentDescription = "Decrease",
                                tint = if (uiState.copies > 1) TextPrimary else TextMuted
                            )
                        }

                        Text(
                            text = "${uiState.copies}",
                            style = MaterialTheme.typography.titleMedium.copy(
                                color = TextPrimary,
                                fontWeight = FontWeight.Bold,
                                fontFamily = FontFamily.Monospace
                            )
                        )

                        IconButton(
                            onClick = { viewModel.incrementCopies() },
                            modifier = Modifier
                                .size(36.dp)
                                .clip(RoundedCornerShape(10.dp))
                                .background(SurfaceCard)
                                .border(1.dp, SurfaceBorder, RoundedCornerShape(10.dp)),
                            enabled = uiState.copies < 100
                        ) {
                            Icon(
                                imageVector = Icons.Default.Add,
                                contentDescription = "Increase",
                                tint = TextPrimary
                            )
                        }
                    }
                }
            }

            // Live Pricing Estimation Card
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(18.dp))
                    .background(SurfaceDark)
                    .border(1.dp, BrandPrimary.copy(alpha = 0.3f), RoundedCornerShape(18.dp))
                    .padding(18.dp)
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(6.dp)
                        ) {
                            Icon(
                                imageVector = Icons.Default.Calculate,
                                contentDescription = null,
                                tint = BrandAccent,
                                modifier = Modifier.size(16.dp)
                            )
                            Text(
                                text = "Live Cost Breakdown",
                                style = MaterialTheme.typography.labelMedium.copy(
                                    color = BrandAccent,
                                    fontWeight = FontWeight.Bold
                                )
                            )
                        }

                        if (uiState.isCalculating) {
                            CircularProgressIndicator(
                                modifier = Modifier.size(14.dp),
                                color = BrandAccent,
                                strokeWidth = 1.5.dp
                            )
                        }
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = "Physical Sheets Required",
                            style = MaterialTheme.typography.bodySmall.copy(color = TextSecondary)
                        )
                        Text(
                            text = "${uiState.pricing.totalSheets} sheets (${uiState.pricing.sheetsPerCopy}/copy)",
                            style = MaterialTheme.typography.bodySmall.copy(
                                color = TextPrimary,
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Medium
                            )
                        )
                    }

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween
                    ) {
                        Text(
                            text = "Print Base Amount",
                            style = MaterialTheme.typography.bodySmall.copy(color = TextSecondary)
                        )
                        Text(
                            text = String.format("₹%.2f", uiState.pricing.itemTotalRupees),
                            style = MaterialTheme.typography.bodySmall.copy(
                                color = TextPrimary,
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Medium
                            )
                        )
                    }

                    Divider(color = SurfaceBorder, thickness = 0.8.dp)

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Total Item Cost",
                            style = MaterialTheme.typography.titleSmall.copy(
                                color = TextPrimary,
                                fontWeight = FontWeight.Bold
                            )
                        )
                        Text(
                            text = String.format("₹%.2f", uiState.pricing.itemTotalRupees),
                            style = MaterialTheme.typography.titleMedium.copy(
                                color = StatusGreen,
                                fontWeight = FontWeight.ExtraBold,
                                fontFamily = FontFamily.Monospace
                            )
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(8.dp))

            // Action Button
            Button(
                onClick = {
                    onProceedToCheckout(
                        uiState.documentId.ifEmpty { documentId },
                        uiState.fileName.ifEmpty { fileName },
                        uiState.pageCount,
                        uiState.colorMode,
                        uiState.duplexMode,
                        uiState.paperSize,
                        uiState.copies,
                        uiState.pricing.totalSheets,
                        uiState.pricing.itemTotalCents
                    )
                },
                modifier = Modifier
                    .fillMaxWidth()
                    .height(54.dp),
                shape = RoundedCornerShape(16.dp),
                colors = ButtonDefaults.buttonColors(containerColor = BrandPrimary)
            ) {
                Text(
                    text = String.format("Proceed to Checkout • ₹%.2f", uiState.pricing.itemTotalRupees),
                    style = MaterialTheme.typography.labelLarge.copy(
                        fontWeight = FontWeight.Bold,
                        color = Color.White
                    )
                )
                Spacer(modifier = Modifier.width(6.dp))
                Icon(imageVector = Icons.Default.ArrowForward, contentDescription = null, tint = Color.White)
            }

            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}

@Composable
private fun SectionCard(
    title: String,
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    content: @Composable ColumnScope.() -> Unit
) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = BrandAccent,
                modifier = Modifier.size(16.dp)
            )
            Text(
                text = title,
                style = MaterialTheme.typography.titleSmall.copy(
                    color = TextPrimary,
                    fontWeight = FontWeight.SemiBold
                )
            )
        }
        content()
    }
}

@Composable
private fun SelectableOptionCard(
    title: String,
    subtitle: String,
    isSelected: Boolean,
    modifier: Modifier = Modifier,
    onClick: () -> Unit
) {
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(14.dp))
            .background(if (isSelected) BrandPrimary.copy(alpha = 0.12f) else SurfaceDark)
            .border(
                width = 1.2.dp,
                color = if (isSelected) BrandPrimary else SurfaceBorder,
                shape = RoundedCornerShape(14.dp)
            )
            .clickable { onClick() }
            .padding(14.dp)
    ) {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                Text(
                    text = title,
                    style = MaterialTheme.typography.bodyMedium.copy(
                        color = if (isSelected) TextPrimary else TextSecondary,
                        fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium
                    )
                )
                if (isSelected) {
                    Icon(
                        imageVector = Icons.Default.CheckCircle,
                        contentDescription = "Selected",
                        tint = BrandAccent,
                        modifier = Modifier.size(16.dp)
                    )
                }
            }
            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodySmall.copy(
                    color = TextMuted,
                    fontSize = 11.sp
                )
            )
        }
    }
}

private fun formatBytes(bytes: Long): String {
    return when {
        bytes >= 1024 * 1024 -> String.format("%.2f MB", bytes / (1024.0 * 1024.0))
        bytes >= 1024 -> String.format("%.1f KB", bytes / 1024.0)
        else -> "$bytes B"
    }
}

