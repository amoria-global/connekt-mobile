package expo.modules.incomingcall

import android.content.Context
import android.content.Intent

/**
 * Legacy keep-alive helper. Push notifications are delivered directly by
 * Firebase Cloud Messaging and APNs without requiring a permanent foreground service.
 */
object KeepAlive {
  private const val PREFS = "incoming_call"
  private const val KEY = "keep_alive"

  fun enabled(context: Context): Boolean = false

  fun set(context: Context, enabled: Boolean) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean(KEY, false).apply()
    stop(context)
  }

  fun start(context: Context) {
    stop(context)
  }

  fun stop(context: Context) {
    try {
      context.stopService(Intent(context, KeepAliveService::class.java))
    } catch (_: Exception) {
    }
  }
}
