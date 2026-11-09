package com.campusprint.bridge.ui.screens.dashboard

import android.app.Activity
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Cable
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.ClearAll
import androidx.compose.material.icons.filled.Print
import androidx.compose.material.icons.filled.Radar
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.campusprint.bridge.data.model.ConnectionState
import com.campusprint.bridge.service.findActivity
import com.campusprint.bridge.ui.screens.dashboard.components.JobCard
import com.campusprint.bridge.ui.theme.BrandPrimary
import com.campusprint.bridge.ui.theme.DarkBackground
import com.campusprint.bridge.ui.theme.DarkBorder
import com.campusprint.bridge.ui.theme.DarkSurface
import com.campusprint.bridge.ui.theme.DarkSurfaceCard
import com.campusprint.bridge.ui.theme.DarkSurfaceElevated
import com.campusprint.bridge.ui.theme.StatusAmber
import com.campusprint.bridge.ui.theme.StatusGreen
import com.campusprint.bridge.ui.theme.StatusRed
import com.campusprint.bridge.ui.theme.TextMuted
import com.campusprint.bridge.ui.theme.TextPrimary
import com.campusprint.bridge.ui.theme.TextSecondary

@Composable
fun DashboardScreen(
    viewModel: DashboardViewModel,
    onNavigateToConnection: () -> Unit,
    modifier: Modifier = Modifier
) {
    val uiState by viewModel.uiState.collectAsState()
    val context = LocalContext.current
    val activity = remember(context) { context.findActivity() }
    val snackbarHostState = remember { SnackbarHostState() }

    LaunchedEffect(uiState.userMessage) {
        uiState.userMessage?.let { msg ->
            snackbarHostState.showSnackbar(msg)
            viewModel.clearUserMessage()
        }
    }

    Scaffold(
        modifier = modifier.fillMaxSize(),
        containerColor = DarkBackground,
        snackbarHost = { SnackbarHost(snackbarHostState) },
        floatingActionButton = {
            ExtendedFloatingActionButton(
                onClick = { viewModel.simulateTestJob() },
                containerColor = BrandPrimary,
                contentColor = Color.White,
                shape = RoundedCornerShape(16.dp),
                icon = {
                    Icon(
                        imageVector = Icons.Default.Add,
                        contentDescription = null,
                        modifier = Modifier.size(18.dp)
                    )
                },
                text = {
                    Text(
                        text = "Simulate Job",
                        style = MaterialTheme.typography.labelLarge
                    )
                }
            )
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
        ) {
            // Stats & Live Summary Header
            QueueSummaryBar(
                queuedCount = uiState.queuedCount,
                printingCount = uiState.printingCount,
                completedCount = uiState.completedCount,
                connectionState = uiState.connectionState,
                onNavigateToConnection = onNavigateToConnection,
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 12.dp)
            )

            // Filter Chips + Quick Actions Row
            Row(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(horizontal = 16.dp, vertical = 6.dp),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically
            ) {
                LazyRow(
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                    modifier = Modifier.weight(1f)
                ) {
                    item {
                        FilterChip(
                            label = "All (${uiState.jobs.size})",
                            isSelected = uiState.currentFilter == JobFilter.ALL,
                            onClick = { viewModel.setFilter(JobFilter.ALL) }
                        )
                    }
                    item {
                        FilterChip(
                            label = "Active (${uiState.queuedCount + uiState.printingCount})",
                            isSelected = uiState.currentFilter == JobFilter.ACTIVE,
                            onClick = { viewModel.setFilter(JobFilter.ACTIVE) }
                        )
                    }
                    item {
                        FilterChip(
                            label = "Completed (${uiState.completedCount})",
                            isSelected = uiState.currentFilter == JobFilter.COMPLETED,
                            onClick = { viewModel.setFilter(JobFilter.COMPLETED) }
                        )
                    }
                    item {
                        FilterChip(
                            label = "Failed",
                            isSelected = uiState.currentFilter == JobFilter.FAILED,
                            onClick = { viewModel.setFilter(JobFilter.FAILED) }
                        )
                    }
                }

                if (uiState.completedCount > 0) {
                    Text(
                        text = "Clear Done",
                        color = TextMuted,
                        fontSize = 12.sp,
                        fontFamily = FontFamily.Monospace,
                        modifier = Modifier
                            .clip(RoundedCornerShape(6.dp))
                            .clickable { viewModel.clearCompletedJobs() }
                            .padding(horizontal = 6.dp, vertical = 4.dp)
                    )
                }
            }

            Spacer(modifier = Modifier.height(6.dp))

            // Main Jobs List or Empty State
            if (uiState.filteredJobs.isEmpty()) {
                EmptyQueueView(
                    connectionState = uiState.connectionState,
                    currentFilter = uiState.currentFilter,
                    onSimulateJob = { viewModel.simulateTestJob() },
                    onNavigateToConnection = onNavigateToConnection,
                    modifier = Modifier
                        .fillMaxSize()
                        .weight(1f)
                )
            } else {
                LazyColumn(
                    contentPadding = PaddingValues(start = 16.dp, end = 16.dp, top = 8.dp, bottom = 88.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp),
                    modifier = Modifier.fillMaxSize()
                ) {
                    items(
                        items = uiState.filteredJobs,
                        key = { it.orderItemId }
                    ) { job ->
                        JobCard(
                            job = job,
                            onDownloadAndPrint = { targetJob ->
                                viewModel.processAndPrintJob(activity, targetJob)
                            },
                            onPrintAgain = { targetJob ->
                                viewModel.processAndPrintJob(activity, targetJob)
                            }
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun QueueSummaryBar(
    queuedCount: Int,
    printingCount: Int,
    completedCount: Int,
    connectionState: ConnectionState,
    onNavigateToConnection: () -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .clip(RoundedCornerShape(14.dp))
            .background(DarkSurfaceCard)
            .border(1.dp, DarkBorder, RoundedCornerShape(14.dp))
            .clickable(enabled = !connectionState.isConnected, onClick = onNavigateToConnection)
            .padding(14.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        MetricBadge(
            count = queuedCount,
            label = "QUEUED",
            color = if (queuedCount > 0) StatusAmber else TextMuted
        )
        Box(
            modifier = Modifier
                .width(1.dp)
                .height(30.dp)
                .background(DarkBorder)
        )
        MetricBadge(
            count = printingCount,
            label = "IN PROGRESS",
            color = if (printingCount > 0) BrandPrimary else TextMuted
        )
        Box(
            modifier = Modifier
                .width(1.dp)
                .height(30.dp)
                .background(DarkBorder)
        )
        MetricBadge(
            count = completedCount,
            label = "COMPLETED",
            color = if (completedCount > 0) StatusGreen else TextMuted
        )
    }
}

@Composable
private fun MetricBadge(count: Int, label: String, color: Color) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = count.toString(),
            color = color,
            fontSize = 18.sp,
            fontWeight = FontWeight.Bold,
            fontFamily = FontFamily.Monospace
        )
        Spacer(modifier = Modifier.height(2.dp))
        Text(
            text = label,
            color = TextSecondary,
            fontSize = 10.sp,
            fontWeight = FontWeight.SemiBold,
            letterSpacing = 0.5.sp
        )
    }
}

@Composable
private fun FilterChip(
    label: String,
    isSelected: Boolean,
    onClick: () -> Unit
) {
    val bgColor = if (isSelected) BrandPrimary.copy(alpha = 0.2f) else DarkSurface
    val borderColor = if (isSelected) BrandPrimary else DarkBorder
    val textColor = if (isSelected) Color.White else TextSecondary

    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(20.dp))
            .background(bgColor)
            .border(1.dp, borderColor, RoundedCornerShape(20.dp))
            .clickable { onClick() }
            .padding(horizontal = 14.dp, vertical = 7.dp)
    ) {
        Text(
            text = label,
            color = textColor,
            fontSize = 12.sp,
            fontWeight = if (isSelected) FontWeight.SemiBold else FontWeight.Normal
        )
    }
}

@Composable
private fun EmptyQueueView(
    connectionState: ConnectionState,
    currentFilter: JobFilter,
    onSimulateJob: () -> Unit,
    onNavigateToConnection: () -> Unit,
    modifier: Modifier = Modifier
) {
    val isConnected = connectionState is ConnectionState.Connected

    val infiniteTransition = rememberInfiniteTransition(label = "radarPulse")
    val radarScale by infiniteTransition.animateFloat(
        initialValue = 0.95f,
        targetValue = 1.15f,
        animationSpec = infiniteRepeatable(
            animation = tween(1500, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Reverse
        ),
        label = "radarScale"
    )

    Column(
        modifier = modifier
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Box(
            modifier = Modifier
                .size(96.dp)
                .scale(if (isConnected) radarScale else 1f)
                .clip(CircleShape)
                .background(if (isConnected) StatusGreen.copy(alpha = 0.1f) else DarkSurfaceElevated)
                .border(
                    1.dp,
                    if (isConnected) StatusGreen.copy(alpha = 0.35f) else DarkBorder,
                    CircleShape
                ),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = if (isConnected) Icons.Default.Radar else Icons.Default.Cable,
                contentDescription = null,
                tint = if (isConnected) StatusGreen else TextMuted,
                modifier = Modifier.size(42.dp)
            )
        }

        Spacer(modifier = Modifier.height(20.dp))

        Text(
            text = when {
                currentFilter != JobFilter.ALL -> "No ${currentFilter.name.lowercase()} jobs"
                isConnected -> "Listening for Print Orders..."
                else -> "Terminal Offline"
            },
            style = MaterialTheme.typography.titleLarge.copy(
                fontWeight = FontWeight.Bold,
                color = TextPrimary
            ),
            textAlign = TextAlign.Center
        )

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = if (isConnected) {
                "Incoming print orders dispatched to ${((connectionState as? ConnectionState.Connected)?.centerId) ?: "this terminal"} will appear here instantly."
            } else {
                "Connect to the server WebSocket to start receiving jobs, or simulate a test job locally."
            },
            style = MaterialTheme.typography.bodyMedium.copy(color = TextSecondary),
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(horizontal = 16.dp)
        )

        Spacer(modifier = Modifier.height(24.dp))

        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Button(
                onClick = onSimulateJob,
                shape = RoundedCornerShape(10.dp),
                colors = ButtonDefaults.buttonColors(containerColor = BrandPrimary)
            ) {
                Icon(
                    imageVector = Icons.Default.Add,
                    contentDescription = null,
                    modifier = Modifier.size(16.dp)
                )
                Spacer(modifier = Modifier.width(6.dp))
                Text("Simulate Test Job")
            }

            if (!isConnected) {
                OutlinedButton(
                    onClick = onNavigateToConnection,
                    shape = RoundedCornerShape(10.dp),
                    border = androidx.compose.foundation.BorderStroke(1.dp, DarkBorder)
                ) {
                    Text("Setup Connection", color = TextPrimary)
                }
            }
        }
    }
}

