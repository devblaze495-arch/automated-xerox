package com.campusprint.student.ui.tracking

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.campusprint.student.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OrderTrackingScreen(
    orderId: String,
    initialOtp: String,
    totalAmountCents: Long,
    onNavigateHome: () -> Unit,
    viewModel: TrackingViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    LaunchedEffect(orderId) {
        viewModel.startTracking(orderId, initialOtp, totalAmountCents)
    }

    // Step mapping
    val currentStep = when (uiState.status) {
        "PAYMENT_PENDING" -> 1
        "PAYMENT_VERIFIED", "WAITING_FOR_OPERATOR", "ACCEPTED", "QUEUED" -> 2
        "PRINTING" -> 3
        "READY_FOR_COLLECTION" -> 4
        "COLLECTED", "COMPLETED" -> 5
        else -> 2
    }

    Scaffold(
        containerColor = BackgroundDark,
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text(
                            text = "Live Order Tracker",
                            style = MaterialTheme.typography.titleMedium.copy(
                                color = TextPrimary,
                                fontWeight = FontWeight.Bold
                            )
                        )
                        Text(
                            text = "Order #${orderId.take(8).uppercase()}",
                            style = MaterialTheme.typography.bodySmall.copy(
                                color = TextSecondary,
                                fontFamily = FontFamily.Monospace,
                                fontSize = 11.sp
                            )
                        )
                    }
                },
                navigationIcon = {
                    IconButton(onClick = onNavigateHome) {
                        Icon(
                            imageVector = Icons.Default.Close,
                            contentDescription = "Close",
                            tint = TextPrimary
                        )
                    }
                },
                actions = {
                    Box(
                        modifier = Modifier
                            .padding(end = 16.dp)
                            .clip(RoundedCornerShape(8.dp))
                            .background(StatusGreen.copy(alpha = 0.15f))
                            .padding(horizontal = 8.dp, vertical = 4.dp)
                    ) {
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            horizontalArrangement = Arrangement.spacedBy(4.dp)
                        ) {
                            Box(
                                modifier = Modifier
                                    .size(6.dp)
                                    .clip(CircleShape)
                                    .background(StatusGreen)
                            )
                            Text(
                                text = "LIVE",
                                style = MaterialTheme.typography.labelSmall.copy(
                                    color = StatusGreen,
                                    fontWeight = FontWeight.Bold,
                                    fontSize = 10.sp
                                )
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
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 20.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(20.dp)
        ) {
            // Hero Pickup OTP Card
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(24.dp))
                    .background(
                        Brush.verticalGradient(
                            colors = listOf(
                                SurfaceDark,
                                SurfaceCard
                            )
                        )
                    )
                    .border(
                        width = 1.5.dp,
                        color = if (currentStep >= 4) StatusGreen else BrandPrimary,
                        shape = RoundedCornerShape(24.dp)
                    )
                    .padding(24.dp),
                contentAlignment = Alignment.Center
            ) {
                Column(
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(10.dp)
                ) {
                    Box(
                        modifier = Modifier
                            .clip(RoundedCornerShape(8.dp))
                            .background(
                                if (currentStep >= 4) StatusGreen.copy(alpha = 0.15f) else BrandPrimary.copy(alpha = 0.15f)
                            )
                            .padding(horizontal = 10.dp, vertical = 4.dp)
                    ) {
                        Text(
                            text = if (currentStep >= 4) "READY FOR PHYSICAL HANDOVER" else "COLLECTION VERIFICATION PASS",
                            style = MaterialTheme.typography.labelSmall.copy(
                                color = if (currentStep >= 4) StatusGreen else BrandAccent,
                                fontWeight = FontWeight.Bold,
                                fontSize = 10.sp,
                                letterSpacing = 1.sp
                            )
                        )
                    }

                    Text(
                        text = "Pickup OTP",
                        style = MaterialTheme.typography.bodySmall.copy(
                            color = TextSecondary
                        )
                    )

                    // 4-Digit OTP Hero Text
                    Text(
                        text = uiState.collectionOtp,
                        style = MaterialTheme.typography.headlineLarge.copy(
                            color = if (currentStep >= 4) StatusGreen else TextPrimary,
                            fontWeight = FontWeight.Black,
                            fontFamily = FontFamily.Monospace,
                            fontSize = 44.sp,
                            letterSpacing = 10.sp
                        )
                    )

                    Text(
                        text = "Show this 4-digit code at the Xerox counter to pick up your prints.",
                        style = MaterialTheme.typography.bodySmall.copy(
                            color = TextSecondary,
                            textAlign = TextAlign.Center,
                            lineHeight = 16.sp
                        ),
                        modifier = Modifier.padding(horizontal = 16.dp)
                    )
                }
            }

            // Visual Status Stepper Card
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(20.dp))
                    .background(SurfaceDark)
                    .border(1.dp, SurfaceBorder, RoundedCornerShape(20.dp))
                    .padding(20.dp)
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    Text(
                        text = "Job Lifecycle Status",
                        style = MaterialTheme.typography.titleSmall.copy(
                            color = TextPrimary,
                            fontWeight = FontWeight.Bold
                        )
                    )

                    StepItem(
                        stepNumber = 1,
                        title = "Order Placed",
                        subtitle = "Payment captured via UPI Gateway",
                        isCompleted = currentStep >= 1,
                        isActive = currentStep == 1
                    )
                    StepItem(
                        stepNumber = 2,
                        title = "Waiting for Shop Open / Queue",
                        subtitle = "Dispatched to campus operator terminal spooler",
                        isCompleted = currentStep >= 2,
                        isActive = currentStep == 2
                    )
                    StepItem(
                        stepNumber = 3,
                        title = "Printing",
                        subtitle = "Hardware printing on Canon PIXMA / imageRUNNER",
                        isCompleted = currentStep >= 3,
                        isActive = currentStep == 3
                    )
                    StepItem(
                        stepNumber = 4,
                        title = "Ready for Pickup",
                        subtitle = "Printed & sorted at the Xerox collection desk",
                        isCompleted = currentStep >= 4,
                        isActive = currentStep == 4
                    )
                    StepItem(
                        stepNumber = 5,
                        title = "Collected",
                        subtitle = "OTP verified and document handed over to student",
                        isCompleted = currentStep >= 5,
                        isActive = currentStep == 5,
                        isLast = true
                    )
                }
            }

            // Queue Metrics Card (if waiting)
            if (uiState.queuePosition != null && uiState.queuePosition!! > 0 && currentStep < 4) {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(16.dp))
                        .background(SurfaceDark)
                        .border(1.dp, SurfaceBorder, RoundedCornerShape(16.dp))
                        .padding(16.dp)
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceAround,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(
                                text = "Queue Position",
                                style = MaterialTheme.typography.bodySmall.copy(color = TextSecondary)
                            )
                            Text(
                                text = "#${uiState.queuePosition}",
                                style = MaterialTheme.typography.titleLarge.copy(
                                    color = BrandAccent,
                                    fontWeight = FontWeight.Bold,
                                    fontFamily = FontFamily.Monospace
                                )
                            )
                        }

                        Divider(
                            modifier = Modifier
                                .height(32.dp)
                                .width(1.dp),
                            color = SurfaceBorder
                        )

                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            Text(
                                text = "Est. Wait Time",
                                style = MaterialTheme.typography.bodySmall.copy(color = TextSecondary)
                            )
                            Text(
                                text = "~${uiState.estimatedWaitMinutes ?: 2} mins",
                                style = MaterialTheme.typography.titleLarge.copy(
                                    color = TextPrimary,
                                    fontWeight = FontWeight.Bold,
                                    fontFamily = FontFamily.Monospace
                                )
                            )
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(10.dp))

            // Start New Print Job
            Button(
                onClick = onNavigateHome,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(54.dp),
                shape = RoundedCornerShape(16.dp),
                colors = ButtonDefaults.buttonColors(containerColor = SurfaceCard)
            ) {
                Icon(imageVector = Icons.Default.Add, contentDescription = null, tint = TextPrimary)
                Spacer(modifier = Modifier.width(8.dp))
                Text(
                    text = "Start Another Print Job",
                    style = MaterialTheme.typography.labelLarge.copy(
                        fontWeight = FontWeight.Bold,
                        color = TextPrimary
                    )
                )
            }

            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}

@Composable
private fun StepItem(
    stepNumber: Int,
    title: String,
    subtitle: String,
    isCompleted: Boolean,
    isActive: Boolean,
    isLast: Boolean = false
) {
    val circleColor by animateColorAsState(
        targetValue = when {
            isCompleted -> StatusGreen
            isActive -> BrandPrimary
            else -> SurfaceBorder
        },
        label = "circleColor"
    )

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(14.dp)
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Box(
                modifier = Modifier
                    .size(28.dp)
                    .clip(CircleShape)
                    .background(circleColor),
                contentAlignment = Alignment.Center
            ) {
                if (isCompleted && !isActive) {
                    Icon(
                        imageVector = Icons.Default.Check,
                        contentDescription = "Done",
                        tint = BackgroundDark,
                        modifier = Modifier.size(16.dp)
                    )
                } else {
                    Text(
                        text = "$stepNumber",
                        style = MaterialTheme.typography.bodySmall.copy(
                            color = if (isActive || isCompleted) Color.White else TextMuted,
                            fontWeight = FontWeight.Bold
                        )
                    )
                }
            }

            if (!isLast) {
                Box(
                    modifier = Modifier
                        .width(2.dp)
                        .height(34.dp)
                        .background(if (isCompleted) StatusGreen.copy(alpha = 0.5f) else SurfaceBorder)
                )
            }
        }

        Column(
            modifier = Modifier.padding(bottom = if (isLast) 0.dp else 12.dp),
            verticalArrangement = Arrangement.spacedBy(2.dp)
        ) {
            Text(
                text = title,
                style = MaterialTheme.typography.bodyMedium.copy(
                    color = if (isActive || isCompleted) TextPrimary else TextMuted,
                    fontWeight = if (isActive || isCompleted) FontWeight.Bold else FontWeight.Normal
                )
            )
            Text(
                text = subtitle,
                style = MaterialTheme.typography.bodySmall.copy(
                    color = if (isActive) BrandAccent else TextMuted,
                    fontSize = 11.sp
                )
            )
        }
    }
}

