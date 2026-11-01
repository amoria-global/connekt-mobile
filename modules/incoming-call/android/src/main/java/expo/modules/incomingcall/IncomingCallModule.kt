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
 * High-priority Android device notification & display wake-up for incoming offers and alerts.
 *
 * Wakes up the locked display (`ACQUIRE_CAUSES_WAKEUP`) and posts a device notification in the
 * OS notification bar & lock screen (`incoming_offer_ring_v2`) with continuous ringtone
 * (`FLAG_INSISTENT`) and vibration, WITHOUT automatically opening the app UI.
 */
class IncomingCallModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw IllegalStateException("No Android context available")

  private val manager: NotificationManager
    get() = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

  override fun definition() = ModuleDefinition {
    Name("IncomingCall")

    Function("show") { id: String, title: String, body: String ->
      showNotification(context, id, title, body, null)
    }

    Function("cancel") { id: String ->
      manager.cancel(id, NOTIFICATION_ID)
    }

    Function("cancelAll") {
      cancelAllNotifications(context)
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

  companion object {
    const val CHANNEL_ID = "incoming_offer_ring_v2"
    const val CHIME_CHANNEL_ID = "connekyt_device_alerts_v2"
    const val NOTIFICATION_ID = 4201
    const val CHIME_NOTIFICATION_ID = 4202
    const val RING_MS = 47_000L

    fun wakeDisplay(context: Context) {
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
        try {
          val power = context.getSystemService(Context.POWER_SERVICE) as PowerManager
          @Suppress("DEPRECATION")
          val fallback = power.newWakeLock(
            PowerManager.FULL_WAKE_LOCK or
              PowerManager.ACQUIRE_CAUSES_WAKEUP or
              PowerManager.ON_AFTER_RELEASE,
            "connekyt:incoming_offer_wake_full",
          )
          fallback.acquire(15_000L)
        } catch (_: Exception) {
        }
      }
    }

    fun ensureRingChannel(context: Context) {
      if (Build.VERSION.SDK_INT < 26) return
      val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      if (nm.getNotificationChannel(CHANNEL_ID) != null) return
      val channel = NotificationChannel(
        CHANNEL_ID,
        "Incoming Offers & Booking Requests",
        NotificationManager.IMPORTANCE_HIGH,
      ).apply {
        description = "Rings in device notifications and wakes the display when a new offer arrives"
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
      nm.createNotificationChannel(channel)
    }

    fun ensureChimeChannel(context: Context) {
      if (Build.VERSION.SDK_INT < 26) return
      val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      if (nm.getNotificationChannel(CHIME_CHANNEL_ID) != null) return
      val channel = NotificationChannel(
        CHIME_CHANNEL_ID,
        "Device Notifications",
        NotificationManager.IMPORTANCE_HIGH,
      ).apply {
        description = "Booking updates, payments, and general notifications"
        lockscreenVisibility = Notification.VISIBILITY_PUBLIC
        enableVibration(true)
        vibrationPattern = longArrayOf(0, 250, 200, 250)
        val raw = context.resources.getIdentifier("connekyt_chime", "raw", context.packageName)
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
      nm.createNotificationChannel(channel)
    }

    fun showNotification(
      context: Context,
      id: String,
      title: String,
      body: String,
      deepLinkPath: String? = null,
    ) {
      ensureRingChannel(context)
      wakeDisplay(context)

      val path = when {
        !deepLinkPath.isNullOrBlank() -> deepLinkPath.trimStart('/')
        id.isNotBlank() && id != "offer" -> "offers/" + Uri.encode(id)
        else -> "bookings?tab=opportunities"
      }

      val launch = Intent(Intent.ACTION_VIEW, Uri.parse("connekt://$path")).apply {
        setPackage(context.packageName)
        addFlags(
          Intent.FLAG_ACTIVITY_NEW_TASK or
            Intent.FLAG_ACTIVITY_CLEAR_TOP or
            Intent.FLAG_ACTIVITY_SINGLE_TOP,
        )
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
        Notification.Builder(context).setPriority(Notification.PRIORITY_MAX)
      }
      builder
        .setSmallIcon(context.applicationInfo.icon)
        .setContentTitle(title)
        .setContentText(body)
        .setStyle(Notification.BigTextStyle().bigText(body))
        .setCategory(Notification.CATEGORY_CALL)
        .setVisibility(Notification.VISIBILITY_PUBLIC)
        .setOngoing(false)
        .setAutoCancel(true)
        .setContentIntent(pending)
      if (Build.VERSION.SDK_INT >= 26) builder.setTimeoutAfter(RING_MS)

      val notification = builder.build()
      notification.flags = notification.flags or Notification.FLAG_INSISTENT
      val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      nm.notify(id, NOTIFICATION_ID, notification)
    }

    fun showChimeNotification(
      context: Context,
      id: String,
      title: String,
      body: String,
    ) {
      ensureChimeChannel(context)
      wakeDisplay(context)

      val launch = context.packageManager.getLaunchIntentForPackage(context.packageName)
        ?: Intent(Intent.ACTION_VIEW, Uri.parse("connekt://notifications")).apply {
          setPackage(context.packageName)
        }
      launch.addFlags(
        Intent.FLAG_ACTIVITY_NEW_TASK or
          Intent.FLAG_ACTIVITY_CLEAR_TOP or
          Intent.FLAG_ACTIVITY_SINGLE_TOP,
      )

      val pending = PendingIntent.getActivity(
        context,
        id.hashCode(),
        launch,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )

      val builder = if (Build.VERSION.SDK_INT >= 26) {
        Notification.Builder(context, CHIME_CHANNEL_ID)
      } else {
        @Suppress("DEPRECATION")
        Notification.Builder(context).setPriority(Notification.PRIORITY_HIGH)
      }
      builder
        .setSmallIcon(context.applicationInfo.icon)
        .setContentTitle(title)
        .setContentText(body)
        .setStyle(Notification.BigTextStyle().bigText(body))
        .setCategory(Notification.CATEGORY_MESSAGE)
        .setVisibility(Notification.VISIBILITY_PUBLIC)
        .setAutoCancel(true)
        .setContentIntent(pending)

      val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      nm.notify(id, CHIME_NOTIFICATION_ID, builder.build())
    }

    fun cancelAllNotifications(context: Context) {
      if (Build.VERSION.SDK_INT >= 23) {
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        for (active in nm.activeNotifications) {
          if (active.id == NOTIFICATION_ID) nm.cancel(active.tag, NOTIFICATION_ID)
        }
      }
    }
  }
}
