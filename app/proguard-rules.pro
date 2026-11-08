# ProGuard rules for CampusPrintBridge
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod

# Keep kotlinx serialization classes
-keepclassmembers class * {
    @kotlinx.serialization.SerialName <fields>;
}
-keepattributes *Annotation*,InnerClasses
-dontwarn kotlinx.serialization.SerializationConstructorMarker

# OkHttp
-dontwarn okhttp3.**
-dontwarn okio.**
-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }

