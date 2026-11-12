# Proguard rules for CampusPrint Student App
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod

# Keep data models serialized by Gson/Kotlinx
-keep class com.campusprint.student.data.models.** { *; }
-keep class com.campusprint.student.data.model.** { *; }
-keepclassmembers class * { @com.google.gson.annotations.SerializedName <fields>; }

# Retrofit 2 rules
-dontwarn retrofit2.**
-keep class retrofit2.** { *; }
-keepattributes Signature
-keepattributes Exceptions
-keepclasseswithmembers class * {
    @retrofit2.http.* <methods>;
}

# OkHttp rules
-dontwarn okhttp3.**
-dontwarn okio.**
-keepnames class okhttp3.internal.publicsuffix.PublicSuffixDatabase

# Coroutines rules
-dontwarn kotlinx.coroutines.**
-keepclassmembers class kotlinx.coroutines.** { *; }
