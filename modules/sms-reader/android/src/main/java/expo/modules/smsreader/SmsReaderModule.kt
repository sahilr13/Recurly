package expo.modules.smsreader

import android.content.pm.PackageManager
import android.net.Uri
import android.provider.Telephony
import android.util.Log
import androidx.core.content.ContextCompat
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class SmsReaderModule : Module() {
  private val tag = "SmsReader"
  private val smsUri: Uri = Uri.parse("content://sms")

  private fun hasReadSms(): Boolean {
    val ctx = appContext.reactContext ?: return false
    return ContextCompat.checkSelfPermission(
      ctx, android.Manifest.permission.READ_SMS
    ) == PackageManager.PERMISSION_GRANTED
  }

  override fun definition() = ModuleDefinition {
    Name("SmsReader")

    // Reports what the OS actually gives us, so "0 messages" is explainable.
    AsyncFunction("diagnose") {
      val out = mutableMapOf<String, Any?>()
      val ctx = appContext.reactContext
      if (ctx == null) {
        out["error"] = "reactContext is null"
        return@AsyncFunction out
      }
      out["permissionGranted"] = hasReadSms()
      out["defaultSmsApp"] = Telephony.Sms.getDefaultSmsPackage(ctx)
      try {
        val cursor = ctx.contentResolver.query(smsUri, arrayOf("_id"), null, null, null)
        if (cursor == null) {
          out["totalRows"] = "cursor is null (provider refused or unavailable)"
        } else {
          cursor.use { out["totalRows"] = it.count }
        }
      } catch (e: Exception) {
        out["error"] = "${e.javaClass.simpleName}: ${e.message}"
      }
      Log.i(tag, "diagnose: $out")
      return@AsyncFunction out
    }

    AsyncFunction("listSms") { minDate: Double, maxCount: Int ->
      val ctx = appContext.reactContext
        ?: throw Exception("reactContext is null")
      if (!hasReadSms()) throw Exception("READ_SMS not granted at native level")

      val smsList = mutableListOf<Map<String, Any?>>()
      val minTime = minDate.toLong()

      val cursor = ctx.contentResolver.query(
        smsUri,
        arrayOf("_id", "address", "body", "date"),
        null, null, "date DESC"
      ) ?: throw Exception("SMS provider returned a null cursor")

      cursor.use {
        val idCol = it.getColumnIndex("_id")
        val addressCol = it.getColumnIndex("address")
        val bodyCol = it.getColumnIndex("body")
        val dateCol = it.getColumnIndex("date")

        while (it.moveToNext()) {
          val dateVal = if (dateCol >= 0) it.getLong(dateCol) else 0L
          // Sorted newest-first, so once we pass the window we can stop.
          if (minTime > 0 && dateVal < minTime) break

          smsList.add(
            mapOf(
              "_id" to if (idCol >= 0) (it.getString(idCol) ?: "") else "",
              "address" to if (addressCol >= 0) (it.getString(addressCol) ?: "") else "",
              "body" to if (bodyCol >= 0) (it.getString(bodyCol) ?: "") else "",
              "date" to dateVal.toString()
            )
          )
          if (smsList.size >= maxCount) break
        }
      }
      Log.i(tag, "listSms returned ${smsList.size} messages")
      return@AsyncFunction smsList
    }
  }
}