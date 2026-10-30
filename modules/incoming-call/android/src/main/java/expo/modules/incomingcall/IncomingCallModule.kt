package expo.modules.incomingcall

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * An incoming-call style alert for a new offer: a full-screen notification that wakes a locked phone, rings
 * until it is answered or times out, and opens the app on tap. Built on the framework notification API only.
 *
 * Android shows the full-screen screen only while the app holds USE_FULL_SCREEN_INTENT (added by the
 * withIncomingCall config plugin). From Android 14 the user can switch it off in system settings, which
 * [canUseFullScreenIntent] reports; the alert then falls back to a loud heads-up notification.
 */
class IncomingCallModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw IllegalStateException("No Android context available")

  private val manager: NotificationManager
    get() = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

  override fun definition() = ModuleDefinition {
    Name("IncomingCall")

    Function("show") { id: String, title: String, body: String ->
      show(id, title, body)
    }

    Function("cancel") { id: String ->
      manager.cancel(id, NOTIFICATION_ID)
    }

    Function("cancelAll") {
      cancelAll()
    }

    Function("canUseFullScreenIntent") {
      if (Build.VERSION.SDK_INT >= 34) manager.canUseFullScreenIntent() else true
    }

    Function("openFullScreenIntentSettings") {
      if (Build.VERSION.SDK_INT >= 34) {
        val intent = Intent(
          Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT,
          Uri.parse("package:" + context.packageName),
        ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(intent)
      }
    }
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < 26) return
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return
    val channel = NotificationChannel(CHANNEL_ID, "Incoming offers", NotificationManager.IMPORTANCE_HIGH).apply {
      description = "Rings like a call when a new event offer arrives"
      lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      enableVibration(true)
      vibrationPattern = longArrayOf(0, 600, 350, 600, 350, 600)
      val raw = context.resources.getIdentifier("connekyt_ringtone", "raw", context.packageName)
      val sound = if (raw != 0) {
        Uri.parse("android.resource://" + context.packageName + "/" + raw)
      } else {
        Settings.System.DEFAULT_RINGTONE_URI
      }
      setSound(
        sound,
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .build(),
      )
      try {
        setBypassDnd(true) // only takes effect if the user has granted Do Not Disturb access
      } catch (_: Exception) {
      }
    }
    manager.createNotificationChannel(channel)
  }

  private fun show(id: String, title: String, body: String) {
    ensureChannel()
    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
      ?: return
    launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
    launch.putExtra("incoming_offer_id", id)
    val pending = PendingIntent.getActivity(
      context,
      id.hashCode(),
      launch,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )

    val builder = if (Build.VERSION.SDK_INT >= 26) {
      Notification.Builder(context, CHANNEL_ID)
    } else {
      @Suppress("DEPRECATION")
      Notification.Builder(context).setPriority(Notification.PRIORITY_MAX)
    }
    builder
      .setSmallIcon(context.applicationInfo.icon)
      .setContentTitle(title)
      .setContentText(body)
      .setCategory(Notification.CATEGORY_CALL)
      .setVisibility(Notification.VISIBILITY_PUBLIC)
      .setOngoing(true)
      .setAutoCancel(true)
      .setContentIntent(pending)
      .setFullScreenIntent(pending, true)
    if (Build.VERSION.SDK_INT >= 26) builder.setTimeoutAfter(RING_MS)

    val notification = builder.build()
    // Keeps the sound repeating until the notification is dismissed or times out, like a ringing call.
    notification.flags = notification.flags or Notification.FLAG_INSISTENT
    manager.notify(id, NOTIFICATION_ID, notification)
  }

  private fun cancelAll() {
    if (Build.VERSION.SDK_INT >= 23) {
      for (active in manager.activeNotifications) {
        if (active.id == NOTIFICATION_ID) manager.cancel(active.tag, NOTIFICATION_ID)
      }
    }
  }

  private companion object {
    const val CHANNEL_ID = "incoming_offer_call_v1"
    const val NOTIFICATION_ID = 4201
    const val RING_MS = 47_000L
  }
}
