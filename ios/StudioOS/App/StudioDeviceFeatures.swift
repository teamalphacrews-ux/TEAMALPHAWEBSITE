import SwiftUI
import UIKit
import UserNotifications
import LocalAuthentication

@MainActor final class StudioDeviceFeatures: NSObject, ObservableObject {
    static let shared = StudioDeviceFeatures()
    @Published private(set) var isLocked: Bool
    @Published private(set) var lockMessage = "Unlock with Face ID, Touch ID or your device passcode."
    private var authenticating = false
    private var authenticationContext: LAContext?
    private var authenticationRevision = UUID()
    private var contextRevision = UUID()
    private var registrationRevision: UUID?
    private var notificationRequestRevision = UUID()
    private var requestingNotifications = false
    private var deviceToken: String?
    private var context: (userId: String, workspaceKey: String)?
    private var pending: [String: String]?
    var onDeviceChange: (() -> Void)?
    var onOpenNotification: (([String: String]) -> Void)?
    private let lockKey = "studio.privacyLockEnabled"
    let installationId: String
    private var pushPreferenceKey: String? { guard let context else { return nil }; return "studio.pushOptIn:\(context.workspaceKey):\(context.userId)" }
    var pushOptIn: Bool { pushPreferenceKey.map { UserDefaults.standard.bool(forKey: $0) } ?? false }
    func disconnectNotifications() async -> [String: Any] {
        notificationRequestRevision = UUID()
        if let key = pushPreferenceKey { UserDefaults.standard.set(false, forKey: key) }
        deviceToken = nil; registrationRevision = nil; pending = nil
        return await status()
    }
    var lockEnabled: Bool { UserDefaults.standard.bool(forKey: lockKey) }
    var pushConfigured: Bool {
        let value = Bundle.main.object(forInfoDictionaryKey: "STUDIO_PUSH_ENABLED")
        return (value as? Bool) == true || (value as? String)?.lowercased() == "true"
    }
    override private init() {
        let defaults = UserDefaults.standard
        if let id = defaults.string(forKey: "studio.installationId"), UUID(uuidString: id) != nil { installationId = id }
        else { let id = UUID().uuidString; installationId = id; defaults.set(id, forKey: "studio.installationId") }
        isLocked = defaults.bool(forKey: "studio.privacyLockEnabled")
        super.init()
    }
    func lock() {
        invalidateAuthentication()
        if lockEnabled { isLocked = true }
    }
    private func invalidateAuthentication() {
        authenticationRevision = UUID()
        authenticationContext?.invalidate(); authenticationContext = nil; authenticating = false
    }
    private func authenticate(_ reason: String) async throws {
        guard !authenticating else { throw NSError(domain: "StudioOS", code: 1, userInfo: [NSLocalizedDescriptionKey: "Authentication is already open."]) }
        let auth = LAContext(); var error: NSError?
        guard auth.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error) else { throw error ?? NSError(domain: "StudioOS", code: 2, userInfo: [NSLocalizedDescriptionKey: "Set a device passcode before enabling app lock."]) }
        let revision = authenticationRevision
        authenticating = true; authenticationContext = auth
        defer {
            auth.invalidate()
            if authenticationContext === auth { authenticationContext = nil; authenticating = false }
        }
        guard try await auth.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: reason) else { throw NSError(domain: "StudioOS", code: 3, userInfo: [NSLocalizedDescriptionKey: "Authentication was cancelled."]) }
        guard revision == authenticationRevision else { throw NSError(domain: "StudioOS", code: 3, userInfo: [NSLocalizedDescriptionKey: "Authentication was cancelled. Unlock the app again."]) }
    }
    func unlock() async {
        guard isLocked, !authenticating else { return }
        do { try await authenticate("Unlock your Studio OS workspace"); isLocked = false; onDeviceChange?(); deliverPending() }
        catch { lockMessage = "Your studio is locked. Try again with biometrics or your device passcode." }
    }
    func setPrivacyLock(_ enabled: Bool) async throws -> [String: Any] {
        try await authenticate(enabled ? "Protect Studio OS when you leave the app" : "Turn off the Studio OS privacy lock")
        UserDefaults.standard.set(enabled, forKey: lockKey); isLocked = false
        return await status()
    }
    func status() async -> [String: Any] {
        let revision = contextRevision
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        let names: [UNAuthorizationStatus: String] = [.notDetermined: "notDetermined", .denied: "denied", .authorized: "authorized", .provisional: "provisional", .ephemeral: "ephemeral"]
        let auth = LAContext(); var error: NSError?
        var result: [String: Any] = ["native": true, "privacyLockEnabled": lockEnabled, "canAuthenticate": auth.canEvaluatePolicy(.deviceOwnerAuthentication, error: &error), "notifications": names[settings.authorizationStatus] ?? "unknown", "pushConfigured": pushConfigured, "pushOptIn": pushOptIn, "installationId": installationId]
        if revision == contextRevision, !isLocked, pushConfigured, pushOptIn, registrationRevision == contextRevision, [.authorized, .provisional, .ephemeral].contains(settings.authorizationStatus), let deviceToken { result["deviceToken"] = deviceToken }
        return result
    }
    func refreshRegistration() async {
        guard pushConfigured && pushOptIn else { return }
        let revision = contextRevision
        let settings = await UNUserNotificationCenter.current().notificationSettings()
        guard revision == contextRevision, pushConfigured, pushOptIn else { return }
        if [.authorized, .provisional, .ephemeral].contains(settings.authorizationStatus) {
            registrationRevision = revision; UIApplication.shared.registerForRemoteNotifications()
        } else { deviceToken = nil; registrationRevision = nil }
    }
    func requestNotifications() async throws -> [String: Any] {
        guard pushConfigured else { throw NSError(domain: "StudioOS", code: 4, userInfo: [NSLocalizedDescriptionKey: "This build needs the Push Notifications capability before connecting this phone."]) }
        guard let key = pushPreferenceKey else { throw NSError(domain: "StudioOS", code: 5, userInfo: [NSLocalizedDescriptionKey: "Sign in to a studio before enabling notifications."]) }
        guard !isLocked, !requestingNotifications else { throw NSError(domain: "StudioOS", code: 6, userInfo: [NSLocalizedDescriptionKey: "Unlock the app and finish the current notification request first."]) }
        let revision = notificationRequestRevision, signedInRevision = contextRevision
        requestingNotifications = true; defer { requestingNotifications = false }
        let allowed = try await UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound])
        guard revision == notificationRequestRevision, signedInRevision == contextRevision, key == pushPreferenceKey, !isLocked else { throw NSError(domain: "StudioOS", code: 7, userInfo: [NSLocalizedDescriptionKey: "Your studio changed. Enable notifications again from the current studio."]) }
        UserDefaults.standard.set(allowed, forKey: key)
        if allowed { registrationRevision = signedInRevision; UIApplication.shared.registerForRemoteNotifications() }
        else { deviceToken = nil; registrationRevision = nil }
        return await status()
    }
    func receivedToken(_ data: Data) {
        guard pushConfigured, pushOptIn, registrationRevision == contextRevision, !data.isEmpty, data.count <= 256 else { return }
        deviceToken = data.map { String(format: "%02x", $0) }.joined(); onDeviceChange?()
    }
    func registrationFailed() { deviceToken = nil; onDeviceChange?() }
    func clearContext() { pauseNavigation(); pending = nil; invalidateAuthentication() }
    func pauseNavigation() {
        context = nil; contextRevision = UUID(); notificationRequestRevision = UUID()
        deviceToken = nil; registrationRevision = nil
    }
    func setContext(userId: String, workspaceKey: String) {
        guard userId.range(of: "^[a-fA-F0-9]{24}$", options: .regularExpression) != nil,
              workspaceKey == "legacy" || workspaceKey.range(of: "^[a-fA-F0-9]{24}$", options: .regularExpression) != nil else { clearContext(); return }
        let changed = context?.userId != userId || context?.workspaceKey != workspaceKey
        if changed { contextRevision = UUID(); notificationRequestRevision = UUID(); deviceToken = nil; registrationRevision = nil }
        context = (userId, workspaceKey); deliverPending()
        if changed { Task { await refreshRegistration() } }
    }
    func receiveNotification(_ info: [AnyHashable: Any]) {
        guard let studio = notificationDetails(info) else { return }
        pending = studio; deliverPending()
    }
    private func notificationDetails(_ info: [AnyHashable: Any]) -> [String: String]? {
        guard let studio = info["studio"] as? [String: String], let path = studio["path"], path.utf8.count <= 600,
              !path.contains("\\"), !path.unicodeScalars.contains(where: { CharacterSet.controlCharacters.contains($0) }),
              let route = URLComponents(string: path), route.scheme == nil, route.host == nil, route.fragment == nil,
              path.hasPrefix("/admin"), route.path.range(of: "^/admin(?:/(?:crm|studio-projects|quotations|invoices|calendar|post-production|chats|finance|activity-log)(?:/[a-fA-F0-9]{24}|/new)?)?$", options: .regularExpression) != nil,
              let userId = studio["userId"], userId.range(of: "^[a-fA-F0-9]{24}$", options: .regularExpression) != nil,
              let workspaceKey = studio["workspaceKey"], workspaceKey == "legacy" || workspaceKey.range(of: "^[a-fA-F0-9]{24}$", options: .regularExpression) != nil else { return nil }
        return ["path": path, "userId": userId, "workspaceKey": workspaceKey]
    }
    func shouldPresentNotification(_ info: [AnyHashable: Any]) -> Bool {
        guard !isLocked, pushOptIn, let context, let studio = notificationDetails(info) else { return false }
        return studio["userId"] == context.userId && studio["workspaceKey"] == context.workspaceKey
    }
    private func deliverPending() {
        guard !isLocked, let context, let pending, let handler = onOpenNotification else { return }
        self.pending = nil
        guard pending["userId"] == context.userId, pending["workspaceKey"] == context.workspaceKey else { return }
        handler(pending)
    }
    func setupNotifications() {
        let open = UNNotificationAction(identifier: "OPEN_STUDIO_RECORD", title: "Open", options: [.foreground, .authenticationRequired])
        let category = UNNotificationCategory(identifier: "STUDIO_ACTIVITY", actions: [open], intentIdentifiers: [], options: [])
        UNUserNotificationCenter.current().setNotificationCategories([category])
        Task { await refreshRegistration() }
    }
}

final class StudioPushAppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        Task { @MainActor in StudioDeviceFeatures.shared.setupNotifications() }
        return true
    }
    func application(_ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken token: Data) { Task { @MainActor in StudioDeviceFeatures.shared.receivedToken(token) } }
    func application(_ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error) { Task { @MainActor in StudioDeviceFeatures.shared.registrationFailed() } }
    func userNotificationCenter(_ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse, withCompletionHandler completion: @escaping () -> Void) {
        guard [UNNotificationDefaultActionIdentifier, "OPEN_STUDIO_RECORD"].contains(response.actionIdentifier) else { completion(); return }
        let info = response.notification.request.content.userInfo
        Task { @MainActor in StudioDeviceFeatures.shared.receiveNotification(info); completion() }
    }
    func userNotificationCenter(_ center: UNUserNotificationCenter, willPresent notification: UNNotification, withCompletionHandler completion: @escaping (UNNotificationPresentationOptions) -> Void) {
        let info = notification.request.content.userInfo
        Task { @MainActor in completion(StudioDeviceFeatures.shared.shouldPresentNotification(info) ? [.list] : []) }
    }
}

struct StudioPrivacyLockView: View {
    @ObservedObject var features: StudioDeviceFeatures
    var body: some View {
        ZStack {
            Color(uiColor: .systemBackground).ignoresSafeArea()
            VStack(spacing: 18) {
                Image(systemName: "lock.shield").font(.system(size: 42, weight: .light)).foregroundStyle(.blue)
                Text("Your studio is private").font(.title2.weight(.semibold))
                Text(features.lockMessage).font(.subheadline).foregroundStyle(.secondary).multilineTextAlignment(.center)
                Button { Task { await features.unlock() } } label: { Label("Unlock Studio OS", systemImage: "faceid").frame(maxWidth: .infinity).padding(.vertical, 9) }.buttonStyle(.borderedProminent).controlSize(.large)
            }.padding(30).frame(maxWidth: 380)
        }.task { await features.unlock() }
    }
}
