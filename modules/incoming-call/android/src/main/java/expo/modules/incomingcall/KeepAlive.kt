package expo.modules.incomingcall

import android.content.Context
import android.content.Intent
import android.os.Build

/**
 * Whether the app should stay ready for offers: set from the app when a photographer is signed in, read again at
 * phone start-up by [BootReceiver], so the service comes back after a restart without the app being opened.
 */
object KeepAlive {
  private const val PREFS = "incoming_call"
  private const val KEY = "keep_alive"

  fun enabled(context: Context): Boolean =
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getBoolean(KEY, false)

  fun set(context: Context, enabled: Boolean) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putBoolean(KEY, enabled).apply()
    if (enabled) start(context) else stop(context)
  }

  fun start(context: Context) {
    val intent = Intent(context, KeepAliveService::class.java)
    try {
      if (Build.VERSION.SDK_INT >= 26) context.startForegroundService(intent) else context.startService(intent)
    } catch (_: Exception) {
      // Android may refuse a foreground start from the background; it is tried again when the app next opens.
    }
  }

  fun stop(context: Context) {
    try {
      context.stopService(Intent(context, KeepAliveService::class.java))
    } catch (_: Exception) {
    }
  }
}
