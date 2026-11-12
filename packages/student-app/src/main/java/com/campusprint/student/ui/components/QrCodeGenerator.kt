package com.campusprint.student.ui.components

import android.graphics.Bitmap
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import java.util.EnumMap

object QrCodeGenerator {
    fun generateQrBitmap(
        content: String,
        widthPx: Int = 512,
        heightPx: Int = 512
    ): ImageBitmap? {
        if (content.isBlank()) return null
        return try {
            val hints = EnumMap<EncodeHintType, Any>(EncodeHintType::class.java).apply {
                put(EncodeHintType.MARGIN, 1)
                put(EncodeHintType.CHARACTER_SET, "UTF-8")
            }
            val bitMatrix = QRCodeWriter().encode(content, BarcodeFormat.QR_CODE, widthPx, heightPx, hints)
            val bitmap = Bitmap.createBitmap(widthPx, heightPx, Bitmap.Config.ARGB_8888)
            for (x in 0 until widthPx) {
                for (y in 0 until heightPx) {
                    bitmap.setPixel(
                        x,
                        y,
                        if (bitMatrix[x, y]) android.graphics.Color.BLACK else android.graphics.Color.WHITE
                    )
                }
            }
            bitmap.asImageBitmap()
        } catch (e: Exception) {
            null
        }
    }
}

@Composable
fun rememberQrBitmap(content: String, sizePx: Int = 512): ImageBitmap? {
    return remember(content, sizePx) {
        QrCodeGenerator.generateQrBitmap(content, sizePx, sizePx)
    }
}

