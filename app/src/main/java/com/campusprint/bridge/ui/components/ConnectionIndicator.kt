package com.campusprint.bridge.ui.components

import androidx.compose.animation.core.FastOutSlowInEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.campusprint.bridge.data.model.ConnectionState
import com.campusprint.bridge.ui.theme.StatusAmber
import com.campusprint.bridge.ui.theme.StatusGreen
import com.campusprint.bridge.ui.theme.StatusRed

/**
 * Compact live connection pill for top app bar or status headers.
 */
@Composable
fun ConnectionPill(
    connectionState: ConnectionState,
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null
) {
    val (statusText, dotColor, bgColor) = when (connectionState) {
        is ConnectionState.Connected -> Triple("Connected", StatusGreen, Color(0xFF064E3B).copy(alpha = 0.5f))
        is ConnectionState.Connecting -> Triple("Connecting", StatusAmber, Color(0xFF451A03).copy(alpha = 0.5f))
        is ConnectionState.Disconnected -> Triple("Disconnected", StatusRed, Color(0xFF450A0A).copy(alpha = 0.5f))
        is ConnectionState.Error -> Triple("Error", StatusRed, Color(0xFF450A0A).copy(alpha = 0.5f))
    }

    val isPulsing = connectionState is ConnectionState.Connecting || connectionState is ConnectionState.Connected

    val infiniteTransition = rememberInfiniteTransition(label = "pulseTransition")
    val pulseScale by if (isPulsing) {
        infiniteTransition.animateFloat(
            initialValue = 0.85f,
            targetValue = 1.25f,
            animationSpec = infiniteRepeatable(
                animation = tween(durationMillis = 1000, easing = FastOutSlowInEasing),
                repeatMode = RepeatMode.Reverse
            ),
            label = "pulseScale"
        )
    } else {
        rememberInfiniteTransition(label = "static").animateFloat(
            initialValue = 1f,
            targetValue = 1f,
            animationSpec = infiniteRepeatable(tween(1000)),
            label = "staticScale"
        )
    }

    val clickableModifier = if (onClick != null) {
        Modifier.clickable { onClick() }
    } else {
        Modifier
    }

    Row(
        modifier = modifier
            .then(clickableModifier)
            .background(bgColor, RoundedCornerShape(20.dp))
            .border(1.dp, dotColor.copy(alpha = 0.4f), RoundedCornerShape(20.dp))
            .padding(horizontal = 10.dp, vertical = 5.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            modifier = Modifier
                .size(8.dp)
                .scale(pulseScale)
                .background(dotColor, CircleShape)
        )
        Spacer(modifier = Modifier.width(6.dp))
        Text(
            text = statusText,
            color = MaterialTheme.colorScheme.onBackground,
            style = MaterialTheme.typography.labelSmall
        )
    }
}

