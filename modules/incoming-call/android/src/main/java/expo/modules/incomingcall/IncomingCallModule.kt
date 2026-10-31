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
 * High-priority lock-screen & display wake-up alert for incoming offers on Android.
 *
 * Acquires a screen wake-lock (`ACQUIRE_CAUSES_WAKEUP`), posts a full-screen lock-screen
 * notification with custom ringtone and vibration pattern on `incoming_offer_call_v1`,
 * and deep-links to `connekt://bookings?tab=opportunities&candidate={id}` on tap.
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
        context.startActivity(
          Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        )
      }
    }

    Function("setKeepReady") { enabled: Boolean ->
      KeepAlive.set(context, enabled)
    }
  }

  private fun wakeDisplay() {
    try {
      val power = context.getSystemService(Context.POWER_SERVICE) as PowerManager
      @Suppress("DEPRECATION")
      val wakeLock = power.newWakeLock(
        PowerManager.SCREEN_BRIGHT_WAKE_LOCK or
          PowerManager.ACQUIRE_CAUSES_WAKEUP or
          PowerManager.ON_AFTER_RELEASE,
        "connekyt:incoming_offer_wake",
      )
      wakeLock.acquire(15_000L)
    } catch (_: Exception) {
      // Ignore if WAKE_LOCK unavailable
    }
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < 26) return
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return
    val channel = NotificationChannel(CHANNEL_ID, "Incoming offers", NotificationManager.IMPORTANCE_HIGH).apply {
      description = "Rings and wakes the lock screen when a new event offer arrives"
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
        setBypassDnd(true)
      } catch (_: Exception) {
      }
    }
    manager.createNotificationChannel(channel)
  }

  private fun show(id: String, title: String, body: String) {
    ensureChannel()
    wakeDisplay()

    val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
      ?: Intent(
        Intent.ACTION_VIEW,
        Uri.parse("connekt://bookings?tab=opportunities&candidate=" + Uri.encode(id)),
      ).apply { setPackage(context.packageName) }

    launch.addFlags(
      Intent.FLAG_ACTIVITY_NEW_TASK or
        Intent.FLAG_ACTIVITY_CLEAR_TOP or
        Intent.FLAG_ACTIVITY_SINGLE_TOP,
    )
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
    notification.flags = notification.flags or Notification.FLAG_INSISTENT
    manager.notify(id, NOTIFICATION_ID, notification)

    if (Settings.canDrawOverlays(context)) {
      try {
        context.startActivity(launch)
      } catch (_: Exception) {
        // The full-screen notification above is still shown on the lock screen.
      }
    }
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
