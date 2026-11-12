import java.util.Properties

plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
    id("org.jetbrains.kotlin.plugin.serialization")
}

val localProps = Properties().apply {
    val localPropertiesFile = rootProject.file("local.properties")
    if (localPropertiesFile.exists()) {
        localPropertiesFile.inputStream().use { load(it) }
    }
}

android {
    namespace = "com.campusprint.student"
    compileSdk = 34

    defaultConfig {
        applicationId = "com.campusprint.student"
        minSdk = 26
        targetSdk = 34
        versionCode = 1
        versionName = "1.0.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables {
            useSupportLibrary = true
        }
    }

    signingConfigs {
        create("release") {
            val keyStoreFilePath = System.getenv("RELEASE_KEYSTORE_PATH")
                ?: localProps.getProperty("release.keystore.path")

            if (keyStoreFilePath != null && file(keyStoreFilePath).exists()) {
                storeFile = file(keyStoreFilePath)
                storePassword = System.getenv("RELEASE_KEYSTORE_PASSWORD")
                    ?: localProps.getProperty("release.keystore.password") ?: "campusprint"
                keyAlias = System.getenv("RELEASE_KEY_ALIAS")
                    ?: localProps.getProperty("release.key.alias") ?: "campusprint"
                keyPassword = System.getenv("RELEASE_KEY_PASSWORD")
                    ?: localProps.getProperty("release.key.password") ?: "campusprint"
            } else {
                // Automated fallback to debug keystore for automated CI/local release builds
                val debugKeystore = file("${System.getProperty("user.home")}/.android/debug.keystore")
                if (debugKeystore.exists()) {
                    storeFile = debugKeystore
                    storePassword = "android"
                    keyAlias = "androiddebugkey"
                    keyPassword = "android"
                } else {
                    initWith(getByName("debug"))
                }
            }
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            signingConfig = signingConfigs.getByName("release")
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
        debug {
            isMinifyEnabled = false
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
    }

    buildFeatures {
        compose = true
    }

    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.11"
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

tasks.matching { it.name == "assembleRelease" }.configureEach {
    doLast {
        val releaseDir = layout.buildDirectory.dir("outputs/apk/release").get().asFile
        val candidateFiles = releaseDir.listFiles { _, name -> name.endsWith(".apk") }
        val defaultApk = candidateFiles?.firstOrNull()
        if (defaultApk != null && defaultApk.exists()) {
            val targetApk = File(releaseDir, "CampusPrint-v1.0.apk")
            defaultApk.copyTo(targetApk, overwrite = true)
            println("✅ Generated standalone release APK: ${targetApk.absolutePath}")
        }
    }
}

dependencies {
    // Jetpack Compose BOM
    val composeBom = platform("androidx.compose:compose-bom:2024.04.01")
    implementation(composeBom)
    androidTestImplementation(composeBom)

    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")

    // Activity & Lifecycle Compose
    implementation("androidx.activity:activity-compose:1.8.2")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.7.0")
    implementation("androidx.lifecycle:lifecycle-runtime-compose:2.7.0")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.7.0")

    // Navigation Compose
    implementation("androidx.navigation:navigation-compose:2.7.7")

    // AndroidX Core KTX
    implementation("androidx.core:core-ktx:1.13.0")

    // Kotlin Coroutines
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-core:1.8.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.0")

    // Kotlinx Serialization JSON
    implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.6.3")

    // Retrofit 2 & OkHttp 4
    implementation("com.squareup.retrofit2:retrofit:2.11.0")
    implementation("com.squareup.retrofit2:converter-gson:2.11.0")
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("com.squareup.okhttp3:logging-interceptor:4.12.0")

    // Debug tooling
    debugImplementation("androidx.compose.ui:ui-tooling")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
}
