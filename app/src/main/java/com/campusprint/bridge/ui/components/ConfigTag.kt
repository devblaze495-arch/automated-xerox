package com.campusprint.bridge.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.MenuBook
import androidx.compose.material.icons.filled.ColorLens
import androidx.compose.material.icons.filled.ContentCopy
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.FilterNone
import androidx.compose.material3.Icon
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.campusprint.bridge.data.model.ColorMode
import com.campusprint.bridge.data.model.DuplexMode
import com.campusprint.bridge.data.model.PaperSize
import com.campusprint.bridge.ui.theme.DarkSurfaceElevated
import com.campusprint.bridge.ui.theme.TextSecondary

/**
 * Modern pill tag displaying a specific print attribute (color, duplex, paper size, copies).
 */
@Composable
fun ConfigTag(
    label: String,
    icon: ImageVector? = null,
    highlight: Boolean = false,
    modifier: Modifier = Modifier
) {
    val borderColor = if (highlight) Color(0xFF6366F1).copy(alpha = 0.5f) else Color(0xFF2B3245)
    val bgColor = if (highlight) Color(0xFF1E2235) else DarkSurfaceElevated
    val textColor = if (highlight) Color(0xFFA5B4FC) else TextSecondary

    Row(
        modifier = modifier
            .background(bgColor, RoundedCornerShape(6.dp))
            .border(1.dp, borderColor, RoundedCornerShape(6.dp))
            .padding(horizontal = 7.dp, vertical = 3.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        if (icon != null) {
            Icon(
                imageVector = icon,
                contentDescription = null,
                tint = textColor,
                modifier = Modifier.size(12.dp)
            )
            Spacer(modifier = Modifier.width(4.dp))
        }
        Text(
            text = label,
            color = textColor,
            fontSize = 11.sp,
            fontWeight = FontWeight.Medium,
            fontFamily = FontFamily.Monospace
        )
    }
}

@Composable
fun ColorModeTag(colorMode: ColorMode) {
    val isColor = colorMode == ColorMode.COLOR
    ConfigTag(
        label = if (isColor) "COLOR" else "B&W",
        icon = Icons.Default.ColorLens,
        highlight = isColor
    )
}

@Composable
fun DuplexTag(duplexMode: DuplexMode) {
    val text = when (duplexMode) {
        DuplexMode.SIMPLEX -> "Simplex (1-sided)"
        DuplexMode.DUPLEX_LONG -> "Duplex (Long Edge)"
        DuplexMode.DUPLEX_SHORT -> "Duplex (Short Edge)"
    }
    ConfigTag(
        label = text,
        icon = Icons.AutoMirrored.Filled.MenuBook,
        highlight = duplexMode != DuplexMode.SIMPLEX
    )
}

@Composable
fun PaperSizeTag(paperSize: PaperSize) {
    ConfigTag(
        label = paperSize.name,
        icon = Icons.Default.Description,
        highlight = paperSize == PaperSize.A3
    )
}

@Composable
fun CopiesTag(copies: Int) {
    ConfigTag(
        label = "x$copies ${if (copies == 1) "Copy" else "Copies"}",
        icon = Icons.Default.ContentCopy,
        highlight = copies > 1
    )
}

@Composable
fun PagesTag(pages: Int) {
    ConfigTag(
        label = "$pages ${if (pages == 1) "pg" else "pgs"}",
        icon = Icons.Default.FilterNone
    )
}

