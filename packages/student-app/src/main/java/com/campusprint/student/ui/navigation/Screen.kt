package com.campusprint.student.ui.navigation

import java.net.URLDecoder
import java.net.URLEncoder
import java.nio.charset.StandardCharsets

sealed class Screen(val route: String) {
    object Upload : Screen("upload")

    object Configure : Screen("configure/{documentId}/{fileName}/{pageCount}/{fileSizeBytes}") {
        fun createRoute(documentId: String, fileName: String, pageCount: Int, fileSizeBytes: Long): String {
            val encodedName = URLEncoder.encode(fileName, StandardCharsets.UTF_8.toString())
            return "configure/$documentId/$encodedName/$pageCount/$fileSizeBytes"
        }
    }

    object Checkout : Screen("checkout/{documentId}/{fileName}/{pageCount}/{colorMode}/{duplexMode}/{paperSize}/{copies}/{totalSheets}/{itemTotalCents}") {
        fun createRoute(
            documentId: String,
            fileName: String,
            pageCount: Int,
            colorMode: String,
            duplexMode: String,
            paperSize: String,
            copies: Int,
            totalSheets: Int,
            itemTotalCents: Long
        ): String {
            val encodedName = URLEncoder.encode(fileName, StandardCharsets.UTF_8.toString())
            return "checkout/$documentId/$encodedName/$pageCount/$colorMode/$duplexMode/$paperSize/$copies/$totalSheets/$itemTotalCents"
        }
    }

    object Tracking : Screen("tracking/{orderId}/{collectionOtp}/{totalAmountCents}") {
        fun createRoute(orderId: String, collectionOtp: String, totalAmountCents: Long): String {
            return "tracking/$orderId/$collectionOtp/$totalAmountCents"
        }
    }
}

