package expo.modules.incomingcall

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Brings the keep-ready service back after the phone starts or the app is updated, if it was switched on. */
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (KeepAlive.enabled(context)) KeepAlive.start(context)
  }
}
