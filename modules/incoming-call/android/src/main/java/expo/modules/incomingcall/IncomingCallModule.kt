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
import android.os.PowerManager
import android.provider.Settings
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * High-importance notification helper for incoming offers on Android.
 *
 * Displays a standard heads-up / lock-screen notification with custom ringtone and vibration pattern
 * on the `incoming_offer_call_v1` channel, and deep-links to `connekt://bookings?tab=opportunities&candidate={id}`
 * when the user taps the notification. Never auto-launches the app or uses fake calling / full-screen intents.
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

    Function("minimizeApp") {
      appContext.currentActivity?.moveTaskToBack(true)
    }

    Function("canDrawOverOtherApps") {
      Settings.canDrawOverlays(context)
    }

    Function("openOverlaySettings") {
      val intent = Intent(
        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
        Uri.parse("package:" + context.packageName),
      ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }

    Function("isIgnoringBatteryOptimizations") {
      val power = context.getSystemService(Context.POWER_SERVICE) as PowerManager
      power.isIgnoringBatteryOptimizations(context.packageName)
    }

    Function("openBatterySettings") {
      val request = Intent(
        Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
        Uri.parse("package:" + context.packageName),
      ).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      try {
        context.startActivity(request)
      } catch (_: Exception) {
        context.startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
      }
    }

    Function("setKeepReady") { enabled: Boolean ->
      KeepAlive.set(context, enabled)
    }
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < 26) return
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return
    val channel = NotificationChannel(CHANNEL_ID, "Incoming offers", NotificationManager.IMPORTANCE_HIGH).apply {
      description = "High-priority alerts when a new event offer arrives"
      lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      enableVibration(true)
      vibrationPattern = longArrayOf(0, 600, 350, 600, 350, 600)
      val raw = context.resources.getIdentifier("connekyt_ringtone", "raw", context.packageName)
      val sound = if (raw != 0) {
        Uri.parse("android.resource://" + context.packageName + "/" + raw)
      } else {
        Settings.System.DEFAULT_NOTIFICATION_URI
      }
      setSound(
        sound,
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_NOTIFICATION)
          .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
          .build(),
      )
    }
    manager.createNotificationChannel(channel)
  }

  private fun show(id: String, title: String, body: String) {
    ensureChannel()
    val deepLinkUri = Uri.parse("connekt://bookings?tab=opportunities&candidate=" + Uri.encode(id))
    val launch = Intent(Intent.ACTION_VIEW, deepLinkUri).apply {
      setPackage(context.packageName)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
      putExtra("incoming_offer_id", id)
    }
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
      Notification.Builder(context).setPriority(Notification.PRIORITY_HIGH)
    }
    builder
      .setSmallIcon(context.applicationInfo.icon)
      .setContentTitle(title)
      .setContentText(body)
      .setCategory(Notification.CATEGORY_MESSAGE)
      .setVisibility(Notification.VISIBILITY_PUBLIC)
      .setAutoCancel(true)
      .setContentIntent(pending)
    if (Build.VERSION.SDK_INT >= 26) builder.setTimeoutAfter(ALERT_TIMEOUT_MS)

    manager.notify(id, NOTIFICATION_ID, builder.build())
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
    const val ALERT_TIMEOUT_MS = 7_200_000L
  }
}
