package com.campusprint.student.ui.checkout

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.border
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLifecycleOwner
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.viewmodel.compose.viewModel
import com.campusprint.student.BuildConfig
import com.campusprint.student.data.repository.CenterRepository
import com.campusprint.student.ui.theme.*

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CheckoutScreen(
    documentId: String,
    fileName: String,
    pageCount: Int,
    colorMode: String,
    duplexMode: String,
    paperSize: String,
    copies: Int,
    totalSheets: Int,
    itemTotalCents: Long,
    onNavigateBack: () -> Unit,
    onPaymentSuccess: (orderId: String, collectionOtp: String, totalAmountCents: Long) -> Unit,
    viewModel: CheckoutViewModel = viewModel()
) {
    val context = LocalContext.current
    val uiState by viewModel.uiState.collectAsState()

    val subtotalRupees = itemTotalCents / 100.0
    val convenienceFeeRupees = 1.00
    val totalPayableRupees = subtotalRupees + convenienceFeeRupees
    var studentPhone by remember { mutableStateOf(CenterRepository.getSavedPhone()) }

    // Automatic payment verification when student returns from UPI App (GPay/PhonePe/Paytm)
    val lifecycleOwner = LocalLifecycleOwner.current
    DisposableEffect(lifecycleOwner) {
        val observer = LifecycleEventObserver { _, event ->
            if (event == Lifecycle.Event.ON_RESUME) {
                viewModel.checkPaymentStatusOnResume()
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
        }
    }

    LaunchedEffect(uiState) {
        if (uiState is CheckoutUiState.PaymentConfirmed) {
            val confirmed = uiState as CheckoutUiState.PaymentConfirmed
            onPaymentSuccess(confirmed.orderId, confirmed.otp, confirmed.totalAmountCents)
        }
    }

    Scaffold(
        containerColor = BackgroundDark,
        topBar = {
            TopAppBar(
                title = {
                    Text(
                        text = "UPI Checkout",
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
            verticalArrangement = Arrangement.spacedBy(18.dp)
        ) {
            // Order Summary Card
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(20.dp))
                    .background(SurfaceDark)
                    .border(1.dp, SurfaceBorder, RoundedCornerShape(20.dp))
                    .padding(18.dp)
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(14.dp)) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Box(
                            modifier = Modifier
                                .size(40.dp)
                                .clip(RoundedCornerShape(10.dp))
                                .background(BrandPrimary.copy(alpha = 0.15f)),
                            contentAlignment = Alignment.Center
                        ) {
                            Icon(
                                imageVector = Icons.Default.ReceiptLong,
                                contentDescription = null,
                                tint = BrandAccent,
                                modifier = Modifier.size(22.dp)
                            )
                        }
                        Column {
                            Text(
                                text = "Order Specification",
                                style = MaterialTheme.typography.titleSmall.copy(
                                    color = TextPrimary,
                                    fontWeight = FontWeight.Bold
                                )
                            )
                            Text(
                                text = fileName,
                                style = MaterialTheme.typography.bodySmall.copy(color = TextSecondary),
                                maxLines = 1
                            )
                        }
                    }

                    HorizontalDivider(color = SurfaceBorder, thickness = 0.8.dp)

                    // Specification badges
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        SpecChip(text = if (colorMode == "COLOR") "Full Color" else "Black & White")
                        SpecChip(text = if (duplexMode == "SIMPLEX") "Single-Sided" else "Double-Sided")
                        SpecChip(text = paperSize)
                        SpecChip(text = "$copies ${if (copies > 1) "Sets" else "Set"}")
                    }

                    // Price Breakdown
                    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        PriceRow(label = "Physical Sheets Required", value = "$totalSheets sheets")
                        PriceRow(label = "Document Impression Cost", value = String.format("₹%.2f", subtotalRupees))
                        PriceRow(label = "Queue Processing & OTP Fee", value = String.format("₹%.2f", convenienceFeeRupees))
                    }

                    HorizontalDivider(color = SurfaceBorder, thickness = 0.8.dp)

                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        Text(
                            text = "Total Payable Amount",
                            style = MaterialTheme.typography.titleMedium.copy(
                                color = TextPrimary,
                                fontWeight = FontWeight.Bold
                            )
                        )
                        Text(
                            text = String.format("₹%.2f", totalPayableRupees),
                            style = MaterialTheme.typography.headlineMedium.copy(
                                color = StatusGreen,
                                fontWeight = FontWeight.ExtraBold,
                                fontFamily = FontFamily.Monospace
                            )
                        )
                    }
                }
            }

            // Mobile Number for WhatsApp / SMS Alert Card
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(SurfaceDark)
                    .border(1.dp, SurfaceBorder, RoundedCornerShape(16.dp))
                    .padding(16.dp)
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.Phone,
                            contentDescription = null,
                            tint = BrandAccent,
                            modifier = Modifier.size(18.dp)
                        )
                        Text(
                            text = "Pickup Notification Alert (SMS/WhatsApp)",
                            style = MaterialTheme.typography.labelMedium.copy(
                                color = TextPrimary,
                                fontWeight = FontWeight.Bold
                            )
                        )
                    }
                    Text(
                        text = "We will send an instant SMS / WhatsApp alert with your Collection OTP once your prints are ready at the counter.",
                        style = MaterialTheme.typography.bodySmall.copy(color = TextSecondary, fontSize = 11.sp)
                    )
                    OutlinedTextField(
                        value = studentPhone,
                        onValueChange = { input ->
                            studentPhone = input.filter { it.isDigit() }.take(10)
                        },
                        placeholder = {
                            Text("10-digit mobile number", color = TextSecondary.copy(alpha = 0.5f), fontSize = 13.sp)
                        },
                        prefix = {
                            Text("+91 ", color = TextPrimary, fontWeight = FontWeight.SemiBold, fontSize = 13.sp)
                        },
                        modifier = Modifier.fillMaxWidth(),
                        singleLine = true,
                        shape = RoundedCornerShape(12.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            focusedBorderColor = BrandPrimary,
                            unfocusedBorderColor = SurfaceBorder,
                            focusedTextColor = TextPrimary,
                            unfocusedTextColor = TextPrimary,
                            focusedContainerColor = SurfaceCard,
                            unfocusedContainerColor = SurfaceCard
                        )
                    )
                }
            }

            // UPI Apps Accepted Notice
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .clip(RoundedCornerShape(16.dp))
                    .background(SurfaceDark)
                    .border(1.dp, SurfaceBorder, RoundedCornerShape(16.dp))
                    .padding(16.dp)
            ) {
                Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(
                        verticalAlignment = Alignment.CenterVertically,
                        horizontalArrangement = Arrangement.spacedBy(6.dp)
                    ) {
                        Icon(
                            imageVector = Icons.Default.QrCodeScanner,
                            contentDescription = null,
                            tint = BrandAccent,
                            modifier = Modifier.size(16.dp)
                        )
                        Text(
                            text = "Universal UPI Direct Payment",
                            style = MaterialTheme.typography.labelMedium.copy(
                                color = BrandAccent,
                                fontWeight = FontWeight.Bold
                            )
                        )
                    }
                    Text(
                        text = "Pay instantly using Google Pay, PhonePe, Paytm, BHIM, or any UPI app. No credit card or pre-funded wallet required.",
                        style = MaterialTheme.typography.bodySmall.copy(color = TextSecondary, lineHeight = 18.sp)
                    )
                }
            }

            // Error Display
            AnimatedVisibility(visible = uiState is CheckoutUiState.Error) {
                val errorMsg = (uiState as? CheckoutUiState.Error)?.message ?: ""
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .clip(RoundedCornerShape(14.dp))
                        .background(StatusRed.copy(alpha = 0.1f))
                        .border(1.dp, StatusRed.copy(alpha = 0.3f), RoundedCornerShape(14.dp))
                        .padding(14.dp)
                ) {
                    Text(
                        text = errorMsg,
                        style = MaterialTheme.typography.bodySmall.copy(color = StatusRed)
                    )
                }
            }

            Spacer(modifier = Modifier.height(6.dp))

            // Action Buttons
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                // Primary: Pay via UPI
                Button(
                    onClick = {
                        if (uiState is CheckoutUiState.OrderReady) {
                            val ready = uiState as CheckoutUiState.OrderReady
                            viewModel.launchUpiChooser(context, ready.upiUri)
                        } else {
                            viewModel.initiateOrderAndPay(
                                context = context,
                                documentId = documentId,
                                fileName = fileName,
                                colorMode = colorMode,
                                paperSize = paperSize,
                                duplexMode = duplexMode,
                                copies = copies,
                                pageCount = pageCount,
                                studentPhone = studentPhone
                            )
                        }
                    },
                    modifier = Modifier
                        .fillMaxWidth()
                        .height(54.dp),
                    shape = RoundedCornerShape(16.dp),
                    colors = ButtonDefaults.buttonColors(containerColor = BrandPrimary),
                    enabled = uiState !is CheckoutUiState.CreatingOrder
                ) {
                    if (uiState is CheckoutUiState.CreatingOrder) {
                        CircularProgressIndicator(
                            modifier = Modifier.size(20.dp),
                            color = Color.White,
                            strokeWidth = 2.dp
                        )
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(text = "Creating Order...", color = Color.White)
                    } else {
                        Icon(imageVector = Icons.Default.Payment, contentDescription = null, tint = Color.White)
                        Spacer(modifier = Modifier.width(8.dp))
                        Text(
                            text = String.format("Pay via UPI • ₹%.2f", totalPayableRupees),
                            style = MaterialTheme.typography.labelLarge.copy(
                                fontWeight = FontWeight.Bold,
                                color = Color.White
                            )
                        )
                    }
                }

                // Sandbox Dev Button: Simulate Payment Success (Hidden in Production Release builds)
                if (BuildConfig.DEBUG) {
                    OutlinedButton(
                        onClick = {
                            if (uiState !is CheckoutUiState.OrderReady) {
                                viewModel.initiateOrderAndPay(
                                    context = context,
                                    documentId = documentId,
                                    fileName = fileName,
                                    colorMode = colorMode,
                                    paperSize = paperSize,
                                    duplexMode = duplexMode,
                                    copies = copies,
                                    pageCount = pageCount,
                                    studentPhone = studentPhone
                                )
                            }
                            viewModel.simulatePaymentSuccess()
                        },
                        modifier = Modifier
                            .fillMaxWidth()
                            .height(50.dp),
                        shape = RoundedCornerShape(16.dp),
                        border = androidx.compose.foundation.BorderStroke(1.dp, StatusGreen.copy(alpha = 0.5f)),
                        colors = ButtonDefaults.outlinedButtonColors(
                            containerColor = StatusGreen.copy(alpha = 0.08f),
                            contentColor = StatusGreen
                        )
                    ) {
                        Icon(
                            imageVector = Icons.Default.Bolt,
                            contentDescription = null,
                            tint = StatusGreen,
                            modifier = Modifier.size(18.dp)
                        )
                        Spacer(modifier = Modifier.width(6.dp))
                        Text(
                            text = "Simulate Payment Success (Local Sandbox)",
                            style = MaterialTheme.typography.labelMedium.copy(
                                fontWeight = FontWeight.Bold,
                                color = StatusGreen
                            )
                        )
                    }
                }
            }

            Spacer(modifier = Modifier.height(24.dp))
        }
    }
}

@Composable
private fun SpecChip(text: String) {
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(8.dp))
            .background(SurfaceCard)
            .padding(horizontal = 8.dp, vertical = 4.dp)
    ) {
        Text(
            text = text,
            style = MaterialTheme.typography.bodySmall.copy(
                color = TextSecondary,
                fontSize = 11.sp,
                fontWeight = FontWeight.Medium
            )
        )
    }
}

@Composable
private fun PriceRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall.copy(color = TextSecondary)
        )
        Text(
            text = value,
            style = MaterialTheme.typography.bodySmall.copy(
                color = TextPrimary,
                fontFamily = FontFamily.Monospace,
                fontWeight = FontWeight.Medium
            )
        )
    }
}

