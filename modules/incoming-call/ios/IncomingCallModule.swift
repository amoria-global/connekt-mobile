import ExpoModulesCore
import UserNotifications

/**
 * Native iOS Swift notification module for incoming offers (`IncomingCall`).
 *
 * Uses `UNUserNotificationCenter` to register the `OPPORTUNITY_ALERT` notification category
 * with `ACTION_APPROVE` ("Accept") and `ACTION_DECLINE` ("Reject") actions, display visible
 * lock-screen and Notification Center alerts with the bundled `connekyt_ringtone.wav` sound
 * and `.timeSensitive` interruption level (when authorized on iOS 15+), and cancel delivered
 * or pending notifications when an offer is answered or expires.
 */
public class IncomingCallModule: Module {
  private static let categoryIdentifier = "OPPORTUNITY_ALERT"
  private static let requestPrefix = "incoming_offer_"

  public func definition() -> ModuleDefinition {
    Name("IncomingCall")

    OnCreate {
      Self.registerCategory()
    }

    Function("show") { (id: String, title: String, body: String) in
      Self.registerCategory()
      Self.presentNotification(id: id, title: title, body: body)
    }

    Function("cancel") { (id: String) in
      let center = UNUserNotificationCenter.current()
      let identifier = Self.requestPrefix + id
      center.removePendingNotificationRequests(withIdentifiers: [identifier, id])
      center.removeDeliveredNotifications(withIdentifiers: [identifier, id])
    }

    Function("cancelAll") {
      let center = UNUserNotificationCenter.current()
      center.getDeliveredNotifications { notifications in
        let ids = notifications
          .map { $0.request.identifier }
          .filter { $0.hasPrefix(Self.requestPrefix) }
        if !ids.isEmpty {
          center.removeDeliveredNotifications(withIdentifiers: ids)
        }
      }
      center.getPendingNotificationRequests { requests in
        let ids = requests
          .map { $0.identifier }
          .filter { $0.hasPrefix(Self.requestPrefix) }
        if !ids.isEmpty {
          center.removePendingNotificationRequests(withIdentifiers: ids)
        }
      }
    }

    Function("canUseFullScreenIntent") {
      return true
    }

    Function("openFullScreenIntentSettings") {}

    Function("minimizeApp") {}

    Function("canDrawOverOtherApps") {
      return true
    }

    Function("openOverlaySettings") {}

    Function("isIgnoringBatteryOptimizations") {
      return true
    }

    Function("openBatterySettings") {}

    Function("setKeepReady") { (_: Bool) in }
  }

  private static func registerCategory() {
    let acceptAction = UNNotificationAction(
      identifier: "ACTION_APPROVE",
      title: "Accept",
      options: [.foreground]
    )
    let rejectAction = UNNotificationAction(
      identifier: "ACTION_DECLINE",
      title: "Reject",
      options: [.destructive, .foreground]
    )
    let category = UNNotificationCategory(
      identifier: categoryIdentifier,
      actions: [acceptAction, rejectAction],
      intentIdentifiers: [],
      options: [.customDismissAction]
    )
    let center = UNUserNotificationCenter.current()
    center.getNotificationCategories { existing in
      var updated = existing
      updated.insert(category)
      center.setNotificationCategories(updated)
    }
  }

  private static func presentNotification(id: String, title: String, body: String) {
    let content = UNMutableNotificationContent()
    content.title = title
    content.body = body
    content.categoryIdentifier = categoryIdentifier
    content.sound = UNNotificationSound(named: UNNotificationSoundName("connekyt_ringtone.wav"))
    content.userInfo = [
      "type": "OPPORTUNITY",
      "candidateId": id,
      "referenceId": id,
      "link": "/opportunities/\(id)"
    ]
    if #available(iOS 15.0, *) {
      content.interruptionLevel = .timeSensitive
    }

    let request = UNNotificationRequest(
      identifier: requestPrefix + id,
      content: content,
      trigger: nil
    )
    UNUserNotificationCenter.current().add(request, withCompletionHandler: nil)
  }
}
