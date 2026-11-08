package com.campusprint.bridge.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.campusprint.bridge.data.model.PrintJobStatus
import com.campusprint.bridge.ui.theme.StatusAmber
import com.campusprint.bridge.ui.theme.StatusAmberBg
import com.campusprint.bridge.ui.theme.StatusBlue
import com.campusprint.bridge.ui.theme.StatusBlueBg
import com.campusprint.bridge.ui.theme.StatusGreen
import com.campusprint.bridge.ui.theme.StatusGreenBg
import com.campusprint.bridge.ui.theme.StatusPurple
import com.campusprint.bridge.ui.theme.StatusPurpleBg
import com.campusprint.bridge.ui.theme.StatusRed
import com.campusprint.bridge.ui.theme.StatusRedBg
import com.campusprint.bridge.ui.theme.TextMuted

/**
 * Visual badge for the lifecycle state of a print job.
 */
@Composable
fun StatusBadge(
    status: PrintJobStatus,
    modifier: Modifier = Modifier
) {
    val (label, fgColor, bgColor) = when (status) {
        PrintJobStatus.QUEUED -> Triple("QUEUED", TextMuted, Color(0xFF1E2433))
        PrintJobStatus.DOWNLOADING -> Triple("DOWNLOADING", StatusAmber, StatusAmberBg)
        PrintJobStatus.READY_TO_PRINT -> Triple("READY TO PRINT", StatusPurple, StatusPurpleBg)
        PrintJobStatus.PRINTING -> Triple("PRINTING", StatusBlue, StatusBlueBg)
        PrintJobStatus.COMPLETED -> Triple("COMPLETED", StatusGreen, StatusGreenBg)
        PrintJobStatus.FAILED -> Triple("FAILED", StatusRed, StatusRedBg)
    }

    Row(
        modifier = modifier
            .background(bgColor, RoundedCornerShape(6.dp))
            .border(1.dp, fgColor.copy(alpha = 0.35f), RoundedCornerShape(6.dp))
            .padding(horizontal = 8.dp, vertical = 3.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(6.dp)
                .background(fgColor, CircleShape)
        )
        Spacer(modifier = Modifier.width(6.dp))
        Text(
            text = label,
            color = fgColor,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold,
            fontFamily = FontFamily.Monospace,
            letterSpacing = 0.5.sp
        )
    }
}

