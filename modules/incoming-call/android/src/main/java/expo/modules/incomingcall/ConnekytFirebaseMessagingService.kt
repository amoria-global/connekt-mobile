package expo.modules.incomingcall

import com.google.firebase.messaging.RemoteMessage
import expo.modules.notifications.service.ExpoFirebaseMessagingService
import org.json.JSONObject

/**
 * Intercepts incoming Firebase Cloud Messaging pushes in native Kotlin before JS loads.
 *
 * Ensures that even when the app is completely closed, backgrounded, or locked:
 * 1. The display wakes up immediately (`IncomingCallModule.wakeDisplay`).
 * 2. Incoming offers and booking requests post directly to the Android device
 *    notification tray (`incoming_offer_ring_v2`) and ring continuously (`FLAG_INSISTENT`)
 *    without requiring the user to open the app.
 */
class ConnekytFirebaseMessagingService : ExpoFirebaseMessagingService() {

  private fun parseJsonMap(raw: String?): JSONObject? {
    if (raw.isNullOrBlank() || !raw.trim().startsWith("{")) return null
    return try {
      JSONObject(raw)
    } catch (_: Exception) {
      null
    }
  }

  private fun optNonEmpty(json: JSONObject?, key: String): String? {
    if (json == null || !json.has(key) || json.isNull(key)) return null
    val v = json.optString(key, "").trim()
    return v.ifEmpty { null }
  }

  override fun onMessageReceived(remoteMessage: RemoteMessage) {
    try {
      val data = remoteMessage.data
      val bodyJson = parseJsonMap(data["body"]) ?: parseJsonMap(data["dataString"])

      val title = remoteMessage.notification?.title
        ?: data["title"]?.takeIf { it.isNotBlank() }
        ?: optNonEmpty(bodyJson, "title")

      val rawMessage = remoteMessage.notification?.body
        ?: data["message"]?.takeIf { it.isNotBlank() }
        ?: optNonEmpty(bodyJson, "body")?.takeIf { !it.trim().startsWith("{") }
        ?: optNonEmpty(bodyJson, "message")
        ?: data["body"]?.takeIf { it.isNotBlank() && !it.trim().startsWith("{") }

      val type = (data["type"] ?: optNonEmpty(bodyJson, "type") ?: "").uppercase()
      val kind = (data["kind"] ?: optNonEmpty(bodyJson, "kind") ?: "").uppercase()
      val origin = (data["origin"] ?: optNonEmpty(bodyJson, "origin") ?: "").uppercase()
      val channelId = data["channelId"] ?: optNonEmpty(bodyJson, "channelId") ?: ""
      val sound = data["sound"] ?: optNonEmpty(bodyJson, "sound") ?: ""

      val candidateId = data["candidateId"] ?: optNonEmpty(bodyJson, "candidateId")
      val referenceId = data["referenceId"] ?: optNonEmpty(bodyJson, "referenceId")
      val eventId = data["eventId"] ?: optNonEmpty(bodyJson, "eventId")

      val isOfferOrBookingRequest =
        type == "OPPORTUNITY" ||
          type == "HYBRID_OPPORTUNITY" ||
          kind == "INCOMING_OFFER" ||
          kind == "BOOKING_REQUEST" ||
          origin == "BOOKING_REQUEST" ||
          channelId.startsWith("urgent_") ||
          sound.contains("ringtone", ignoreCase = true)

      if (isOfferOrBookingRequest) {
        val id = candidateId
          ?: referenceId
          ?: eventId
          ?: remoteMessage.messageId
          ?: "offer"

        val isBookingRequest =
          origin == "BOOKING_REQUEST" ||
            (kind == "BOOKING_REQUEST" && type != "OPPORTUNITY" && type != "HYBRID_OPPORTUNITY")

        val deepLinkPath = when {
          isBookingRequest && id != "offer" -> "bookings/$id"
          id != "offer" -> "offers/$id"
          else -> "bookings?tab=opportunities"
        }

        IncomingCallModule.showNotification(
          applicationContext,
          id,
          title ?: "New event offer",
          rawMessage ?: "Tap to review and respond.",
          deepLinkPath,
        )
      } else if (!title.isNullOrBlank() || !rawMessage.isNullOrBlank()) {
        IncomingCallModule.wakeDisplay(applicationContext)
        if (remoteMessage.notification == null && data["title"].isNullOrBlank()) {
          val id = referenceId ?: eventId ?: remoteMessage.messageId ?: "notif"
          IncomingCallModule.showChimeNotification(
            applicationContext,
            id,
            title ?: "Connekyt",
            rawMessage ?: "",
          )
        }
      }
    } catch (_: Exception) {
      // Never block super.onMessageReceived
    }

    super.onMessageReceived(remoteMessage)
  }
}
