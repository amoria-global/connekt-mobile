package expo.modules.incomingcall

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder

/**
 * A quiet foreground service that keeps the app running in the background so a new offer can ring at once, also
 * after the phone has restarted. Android requires a visible notification for it; it is silent and tucked away.
 */
class KeepAliveService : Service() {
  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (Build.VERSION.SDK_INT >= 26 && manager.getNotificationChannel(CHANNEL_ID) == null) {
      val channel = NotificationChannel(CHANNEL_ID, "Ready for offers", NotificationManager.IMPORTANCE_MIN).apply {
        description = "Keeps Connekyt ready to ring the moment a new offer arrives"
        setShowBadge(false)
      }
      manager.createNotificationChannel(channel)
    }

    val launch = packageManager.getLaunchIntentForPackage(packageName)
    val pending = launch?.let {
      PendingIntent.getActivity(this, 0, it, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }
    val builder = if (Build.VERSION.SDK_INT >= 26) Notification.Builder(this, CHANNEL_ID) else Notification.Builder(this)
    builder
      .setSmallIcon(applicationInfo.icon)
      .setContentTitle("Connekyt is ready")
      .setContentText("You will be alerted the moment a new offer arrives.")
      .setOngoing(true)
      .setCategory(Notification.CATEGORY_SERVICE)
    if (pending != null) builder.setContentIntent(pending)
    val notification = builder.build()

    try {
      if (Build.VERSION.SDK_INT >= 34) {
        startForeground(NOTIFICATION_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
      } else {
        startForeground(NOTIFICATION_ID, notification)
      }
    } catch (_: Exception) {
      stopSelf()
      return START_NOT_STICKY
    }
    return START_STICKY
  }

  private companion object {
    const val CHANNEL_ID = "offers_ready_v1"
    const val NOTIFICATION_ID = 4202
  }
}
