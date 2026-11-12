package com.campusprint.student.ui.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.navArgument
import com.campusprint.student.ui.checkout.CheckoutScreen
import com.campusprint.student.ui.configure.ConfigureJobScreen
import com.campusprint.student.ui.tracking.OrderTrackingScreen
import com.campusprint.student.ui.upload.UploadScreen
import java.net.URLDecoder
import java.nio.charset.StandardCharsets

@Composable
fun AppNavHost(
    navController: NavHostController,
    startDestination: String = Screen.Upload.route
) {
    NavHost(
        navController = navController,
        startDestination = startDestination
    ) {
        composable(Screen.Upload.route) {
            UploadScreen(
                onNavigateToConfigure = { documentId, fileName, pageCount, fileSizeBytes ->
                    navController.navigate(
                        Screen.Configure.createRoute(documentId, fileName, pageCount, fileSizeBytes)
                    )
                },
                onNavigateToTracking = { orderId, otp, totalAmountCents ->
                    navController.navigate(
                        Screen.Tracking.createRoute(orderId, otp, totalAmountCents)
                    )
                }
            )
        }

        composable(
            route = Screen.Configure.route,
            arguments = listOf(
                navArgument("documentId") { type = NavType.StringType },
                navArgument("fileName") { type = NavType.StringType },
                navArgument("pageCount") { type = NavType.IntType },
                navArgument("fileSizeBytes") { type = NavType.LongType }
            )
        ) { backStackEntry ->
            val documentId = backStackEntry.arguments?.getString("documentId") ?: ""
            val rawFileName = backStackEntry.arguments?.getString("fileName") ?: "document.pdf"
            val fileName = try {
                URLDecoder.decode(rawFileName, StandardCharsets.UTF_8.toString())
            } catch (_: Exception) {
                rawFileName
            }
            val pageCount = backStackEntry.arguments?.getInt("pageCount") ?: 1
            val fileSizeBytes = backStackEntry.arguments?.getLong("fileSizeBytes") ?: 0L

            ConfigureJobScreen(
                documentId = documentId,
                fileName = fileName,
                pageCount = pageCount,
                fileSizeBytes = fileSizeBytes,
                onNavigateBack = { navController.popBackStack() },
                onProceedToCheckout = { docId, fName, pCount, color, duplex, paper, copies, totalSheets, totalCents ->
                    navController.navigate(
                        Screen.Checkout.createRoute(
                            documentId = docId,
                            fileName = fName,
                            pageCount = pCount,
                            colorMode = color,
                            duplexMode = duplex,
                            paperSize = paper,
                            copies = copies,
                            totalSheets = totalSheets,
                            itemTotalCents = totalCents
                        )
                    )
                }
            )
        }

        composable(
            route = Screen.Checkout.route,
            arguments = listOf(
                navArgument("documentId") { type = NavType.StringType },
                navArgument("fileName") { type = NavType.StringType },
                navArgument("pageCount") { type = NavType.IntType },
                navArgument("colorMode") { type = NavType.StringType },
                navArgument("duplexMode") { type = NavType.StringType },
                navArgument("paperSize") { type = NavType.StringType },
                navArgument("copies") { type = NavType.IntType },
                navArgument("totalSheets") { type = NavType.IntType },
                navArgument("itemTotalCents") { type = NavType.LongType }
            )
        ) { backStackEntry ->
            val documentId = backStackEntry.arguments?.getString("documentId") ?: ""
            val rawFileName = backStackEntry.arguments?.getString("fileName") ?: "document.pdf"
            val fileName = try {
                URLDecoder.decode(rawFileName, StandardCharsets.UTF_8.toString())
            } catch (_: Exception) {
                rawFileName
            }
            val pageCount = backStackEntry.arguments?.getInt("pageCount") ?: 1
            val colorMode = backStackEntry.arguments?.getString("colorMode") ?: "BW"
            val duplexMode = backStackEntry.arguments?.getString("duplexMode") ?: "SIMPLEX"
            val paperSize = backStackEntry.arguments?.getString("paperSize") ?: "A4"
            val copies = backStackEntry.arguments?.getInt("copies") ?: 1
            val totalSheets = backStackEntry.arguments?.getInt("totalSheets") ?: 1
            val itemTotalCents = backStackEntry.arguments?.getLong("itemTotalCents") ?: 100L

            CheckoutScreen(
                documentId = documentId,
                fileName = fileName,
                pageCount = pageCount,
                colorMode = colorMode,
                duplexMode = duplexMode,
                paperSize = paperSize,
                copies = copies,
                totalSheets = totalSheets,
                itemTotalCents = itemTotalCents,
                onNavigateBack = { navController.popBackStack() },
                onPaymentSuccess = { orderId, otp, totalAmountCents ->
                    navController.navigate(
                        Screen.Tracking.createRoute(orderId, otp, totalAmountCents)
                    ) {
                        popUpTo(Screen.Upload.route) { inclusive = false }
                    }
                }
            )
        }

        composable(
            route = Screen.Tracking.route,
            arguments = listOf(
                navArgument("orderId") { type = NavType.StringType },
                navArgument("collectionOtp") { type = NavType.StringType },
                navArgument("totalAmountCents") { type = NavType.LongType }
            )
        ) { backStackEntry ->
            val orderId = backStackEntry.arguments?.getString("orderId") ?: ""
            val collectionOtp = backStackEntry.arguments?.getString("collectionOtp") ?: "----"
            val totalAmountCents = backStackEntry.arguments?.getLong("totalAmountCents") ?: 0L

            OrderTrackingScreen(
                orderId = orderId,
                initialOtp = collectionOtp,
                totalAmountCents = totalAmountCents,
                onNavigateHome = {
                    navController.navigate(Screen.Upload.route) {
                        popUpTo(Screen.Upload.route) { inclusive = true }
                    }
                }
            )
        }
    }
}

