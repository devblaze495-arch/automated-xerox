# Proguard rules for CampusPrint Student App
-keepattributes *Annotation*,Signature,InnerClasses,EnclosingMethod

# Keep data models serialized by Gson/Kotlinx
-keepclassmembers class com.campusprint.student.data.model.** { <fields>; }

