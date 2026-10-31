import SwiftUI
import UIKit
import WebKit
import SafariServices
import AuthenticationServices
import Network

struct StudioWebWorkspace: UIViewControllerRepresentable {
    let configuration: StudioConfiguration
    func makeUIViewController(context: Context) -> StudioWebController { StudioWebController(configuration: configuration) }
    func updateUIViewController(_ controller: StudioWebController, context: Context) {}
    static func dismantleUIViewController(_ controller: StudioWebController, coordinator: ()) { controller.shutdown() }
}

final class StudioWebController: UIViewController, WKNavigationDelegate, WKUIDelegate, WKScriptMessageHandlerWithReply, WKDownloadDelegate, ASWebAuthenticationPresentationContextProviding {
    private let configuration: StudioConfiguration
    private(set) var web: WKWebView!
    private let progress = UIProgressView(progressViewStyle: .bar)
    private let errorCover = UIView(), errorLabel = UILabel()
    private let monitor = NWPathMonitor()
    private var observation: NSKeyValueObservation?
    private var authSession: ASWebAuthenticationSession?
    private var activeShareCompletion: ((Bool) -> Void)?
    private var previewWeb: WKWebView?
    private var previewNavigation: UINavigationController?
    private var fileGeneration = UUID()
    private var fileOperation: UUID?
    private let fileQueue = DispatchQueue(label: "studio.web.documents", qos: .userInitiated)
    private var downloadGenerations: [ObjectIdentifier: UUID] = [:]
    private var presentationHost: UIViewController { previewNavigation?.topViewController ?? self }

    private var lifecycleObservers: [NSObjectProtocol] = []
    private var privacyShield: UIView?
    private func installLifecycleProtection() {
        let center = NotificationCenter.default
        lifecycleObservers.append(center.addObserver(forName: UIApplication.willResignActiveNotification, object: nil, queue: .main) { [weak self] _ in
            guard let self, self.privacyShield == nil, let window = self.view.window else { return }
            let shield = UIView(frame: window.bounds)
            shield.autoresizingMask = [.flexibleWidth, .flexibleHeight]
            shield.backgroundColor = .systemBackground
            let label = UILabel(); label.text = "Studio OS Ultra"; label.font = .preferredFont(forTextStyle: .title2)
            label.textColor = .label; label.translatesAutoresizingMaskIntoConstraints = false
            shield.addSubview(label)
            NSLayoutConstraint.activate([label.centerXAnchor.constraint(equalTo: shield.centerXAnchor), label.centerYAnchor.constraint(equalTo: shield.centerYAnchor)])
            window.addSubview(shield); self.privacyShield = shield
        })
        lifecycleObservers.append(center.addObserver(forName: UIApplication.didEnterBackgroundNotification, object: nil, queue: .main) { [weak self] _ in
            guard let self else { return }
            self.cancelFiles(); self.closePreview()
            UIPrintInteractionController.shared.dismiss(animated: false)
            self.presentedViewController?.dismiss(animated: false)
        })
        lifecycleObservers.append(center.addObserver(forName: UIApplication.didBecomeActiveNotification, object: nil, queue: .main) { [weak self] _ in
            DispatchQueue.main.async { self?.privacyShield?.removeFromSuperview(); self?.privacyShield = nil }
        })
    }

    private var identity = UUID()
    private let maximumBytes = 50 * 1024 * 1024
    private var directories = Set<URL>()
    private var downloads: [ObjectIdentifier: (WKDownload, URL)] = [:]
    private var blob: PendingDocument?
    private struct PendingDocument {
        let id: String, url: URL, size: Int, handle: FileHandle
        var received = 0, index = 0
    }
    init(configuration: StudioConfiguration) { self.configuration = configuration; super.init(nibName: nil, bundle: nil) }
    required init?(coder: NSCoder) { fatalError("Use init(configuration:)") }
    override func viewDidLoad() {
        super.viewDidLoad(); view.backgroundColor = .systemBackground
        let content = WKUserContentController()
        content.addScriptMessageHandler(self, contentWorld: .page, name: "studioOS")
        let settings = WKWebViewConfiguration(); settings.websiteDataStore = .default(); settings.userContentController = content
        settings.allowsInlineMediaPlayback = true
        settings.preferences.javaScriptCanOpenWindowsAutomatically = false
        let source = Bundle.main.url(forResource: "StudioNativeBridge", withExtension: "js").flatMap { try? String(contentsOf: $0, encoding: .utf8) }
        if let source { content.addUserScript(WKUserScript(source: source, injectionTime: .atDocumentStart, forMainFrameOnly: true)) }
        web = WKWebView(frame: .zero, configuration: settings); web.navigationDelegate = self; web.uiDelegate = self
        web.allowsBackForwardNavigationGestures = true; web.scrollView.contentInsetAdjustmentBehavior = .never
        web.isOpaque = false; web.backgroundColor = .systemBackground; view.addSubview(web)
        web.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([web.leadingAnchor.constraint(equalTo: view.leadingAnchor), web.trailingAnchor.constraint(equalTo: view.trailingAnchor), web.topAnchor.constraint(equalTo: view.topAnchor), web.bottomAnchor.constraint(equalTo: view.bottomAnchor)])
        StudioDeviceFeatures.shared.onDeviceChange = { [weak self] in self?.emitDeviceEvent("studio-native:device-change", detail: [:]) }
        StudioDeviceFeatures.shared.onOpenNotification = { [weak self] detail in self?.emitDeviceEvent("studio-native:notification", detail: detail) }
        progress.translatesAutoresizingMaskIntoConstraints = false; view.addSubview(progress)
        NSLayoutConstraint.activate([progress.leadingAnchor.constraint(equalTo: view.leadingAnchor), progress.trailingAnchor.constraint(equalTo: view.trailingAnchor), progress.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor)])
        configureErrorCover(); installLifecycleProtection()
        observation = web.observe(\.estimatedProgress, options: [.new]) { [weak self] web, _ in
            self?.progress.progress = Float(web.estimatedProgress); self?.progress.isHidden = web.estimatedProgress >= 1
        }
        monitor.pathUpdateHandler = { [weak self] path in
            guard path.status == .unsatisfied else { return }
            DispatchQueue.main.async { guard let self, self.web.url == nil else { return }; self.failure("You’re offline. Reconnect, then retry opening your studio.") }
        }
        monitor.start(queue: DispatchQueue(label: "studio.web.network"))
        guard source != nil else { failure("The app’s browser support file is missing. Rebuild Studio OS with StudioNativeBridge.js included."); return }
        guard configuration.validationError == nil else { failure(configuration.validationError!); return }
        loadInitial()
    }
    private func emitDeviceEvent(_ name: String, detail: [String: String]) {
        guard web?.url.map(trusted) == true, let bytes = try? JSONSerialization.data(withJSONObject: detail), let json = String(data: bytes, encoding: .utf8) else { return }
        web.evaluateJavaScript("window.dispatchEvent(new CustomEvent('\(name)', {detail: \(json)}));", completionHandler: nil)
    }
    private func configureErrorCover() {
        errorCover.backgroundColor = .systemBackground; errorCover.isHidden = true; errorCover.translatesAutoresizingMaskIntoConstraints = false; view.addSubview(errorCover)
        NSLayoutConstraint.activate([errorCover.leadingAnchor.constraint(equalTo: view.leadingAnchor), errorCover.trailingAnchor.constraint(equalTo: view.trailingAnchor), errorCover.topAnchor.constraint(equalTo: view.topAnchor), errorCover.bottomAnchor.constraint(equalTo: view.bottomAnchor)])
        errorLabel.numberOfLines = 0; errorLabel.textAlignment = .center; errorLabel.textColor = .secondaryLabel
        let retry = UIButton(type: .system); retry.setTitle("Retry", for: .normal); retry.addTarget(self, action: #selector(retryLoading), for: .touchUpInside)
        let stack = UIStackView(arrangedSubviews: [errorLabel, retry]); stack.axis = .vertical; stack.spacing = 20; stack.translatesAutoresizingMaskIntoConstraints = false; errorCover.addSubview(stack)
        NSLayoutConstraint.activate([stack.centerYAnchor.constraint(equalTo: errorCover.centerYAnchor), stack.leadingAnchor.constraint(equalTo: errorCover.leadingAnchor, constant: 30), stack.trailingAnchor.constraint(equalTo: errorCover.trailingAnchor, constant: -30)])
    }
    private func sameOrigin(_ url: URL, _ base: URL) -> Bool {
        func port(_ value: URL) -> Int { value.port ?? (value.scheme?.lowercased() == "https" ? 443 : 80) }
        return url.user == nil && url.password == nil && url.scheme?.lowercased() == base.scheme?.lowercased() && url.host?.lowercased() == base.host?.lowercased() && port(url) == port(base)
    }
    private func trusted(_ url: URL) -> Bool {
        if url.scheme == "blob", let nested = URL(string: String(url.absoluteString.dropFirst(5))) { return trusted(nested) }
        guard url.scheme == "https" || (configuration.allowsLocalHTTP && url.scheme == "http") else { return false }
        return sameOrigin(url, configuration.webURL)
    }
    private func startURL() -> URL { configuration.startURL }
    private func loadInitial() { guard configuration.validationError == nil else { failure(configuration.validationError!); return }; errorCover.isHidden = true; web.load(URLRequest(url: startURL())) }
    @objc private func retryLoading() { guard configuration.validationError == nil else { failure(configuration.validationError!); return }; errorCover.isHidden = true; if let url = web.url, trusted(url) { web.reload() } else { loadInitial() } }
    private func failure(_ message: String) { progress.isHidden = true; errorLabel.text = message; errorCover.isHidden = false }
    private func alert(_ message: String, then completion: (() -> Void)? = nil) {
        let host = presentationHost
        guard host.presentedViewController == nil else { completion?(); return }
        let dialog = UIAlertController(title: "Studio OS", message: message, preferredStyle: .alert)
        dialog.addAction(UIAlertAction(title: "OK", style: .default) { _ in completion?() }); host.present(dialog, animated: true)
    }
    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) { guard webView === web else { return }; StudioDeviceFeatures.shared.pauseNavigation(); errorCover.isHidden = true; progress.isHidden = false }
    func webView(_ webView: WKWebView, didCommit navigation: WKNavigation!) {
        cancelFiles()
        if webView === web { identity = UUID(); closePreview() }
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        if webView === web { errorCover.isHidden = true; progress.isHidden = true }
        else { previewNavigation?.topViewController?.title = webView.title ?? "Preview" }
    }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) { navigationFailed(error, source: webView) }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) { navigationFailed(error, source: webView) }
    private func navigationFailed(_ error: Error, source: WKWebView) {
        guard (error as NSError).code != NSURLErrorCancelled else { return }
        if source === web { failure("Your studio could not load. Check your connection and retry.") }
        else { alert("This preview could not load. Close it and try again.") }
    }
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        if webView === previewWeb { closePreview(); alert("This preview stopped. Open it again from your workspace."); return }
        cancelFiles(); closePreview(); UIPrintInteractionController.shared.dismiss(animated: false); presentedViewController?.dismiss(animated: false)
        failure("The studio browser stopped. Tap Retry to reopen this screen.")
    }
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction, decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url else { decisionHandler(.cancel); return }
        if action.targetFrame?.isMainFrame == false {
            decisionHandler(["https", "http", "about"].contains(url.scheme ?? "") ? .allow : .cancel); return
        }
        if let callback = authenticationCallback(for: url) { decisionHandler(.cancel); beginAuthentication(url, callbackPath: callback); return }
        if trusted(url) { decisionHandler(action.shouldPerformDownload ? .download : .allow); return }
        decisionHandler(.cancel); openExternal(url, clicked: action.navigationType == .linkActivated)
    }
    func webView(_ webView: WKWebView, decidePolicyFor response: WKNavigationResponse, decisionHandler: @escaping (WKNavigationResponsePolicy) -> Void) {
        let attachment = (response.response as? HTTPURLResponse)?.value(forHTTPHeaderField: "Content-Disposition")?.lowercased().contains("attachment") == true
        if response.isForMainFrame && (!response.canShowMIMEType || attachment) { decisionHandler(response.response.url.map(trusted) == true ? .download : .cancel) }
        else { decisionHandler(.allow) }
    }
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration, for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        guard action.targetFrame == nil, let url = action.request.url else { return nil }
        if let callback = authenticationCallback(for: url) { beginAuthentication(url, callbackPath: callback); return nil }
        // Automatic popups are disabled; this new-window callback requires WebKit user activation.
        guard trusted(url) else { openExternal(url, clicked: true); return nil }
        guard previewWeb == nil, presentedViewController == nil else { return nil }
        let preview = WKWebView(frame: .zero, configuration: configuration)
        preview.navigationDelegate = self; preview.uiDelegate = self
        preview.allowsBackForwardNavigationGestures = true
        let controller = UIViewController(); controller.view = preview; controller.title = "Preview"
        controller.navigationItem.rightBarButtonItem = UIBarButtonItem(barButtonSystemItem: .done, target: self, action: #selector(closePreview))
        let navigation = UINavigationController(rootViewController: controller)
        navigation.modalPresentationStyle = .fullScreen
        previewWeb = preview; previewNavigation = navigation
        present(navigation, animated: true)
        return preview
    }
    @objc private func closePreview() {
        guard let preview = previewWeb else { return }
        cancelFiles()
        preview.stopLoading(); preview.navigationDelegate = nil; preview.uiDelegate = nil
        previewNavigation?.dismiss(animated: true)
        previewNavigation = nil; previewWeb = nil
    }
    func webViewDidClose(_ webView: WKWebView) { if webView === previewWeb { closePreview() } }
    private func openExternal(_ url: URL, clicked: Bool) {
        guard clicked, UIApplication.shared.applicationState == .active, !StudioDeviceFeatures.shared.isLocked,
              url.user == nil, url.password == nil else { return }
        let host = presentationHost
        if ["https", "http"].contains(url.scheme?.lowercased() ?? "") {
            guard host.presentedViewController == nil else { return }
            host.present(SFSafariViewController(url: url), animated: true)
        } else if ["mailto", "tel", "sms", "whatsapp", "upi"].contains(url.scheme?.lowercased() ?? "") {
            UIApplication.shared.open(url, options: [:]) { [weak self] opened in
                if !opened { self?.alert("No installed app can open this link.") }
            }
        }
    }
    private func authenticationCallback(for url: URL) -> String? {
        let host = url.host?.lowercased() ?? "", path = url.path
        if sameOrigin(url, configuration.apiURL) || sameOrigin(url, configuration.webURL) {
            if path == "/api/integrations/gmail/begin" { return "/admin/email" }
            if path.hasPrefix("/api/"), path.contains("google"), path.hasSuffix("/begin") { return "/admin/calendar" }
        }
        guard ["accounts.google.com", "appleid.apple.com"].contains(host), url.scheme == "https" else { return nil }
        if web.url?.path == "/admin/calendar" { return "/admin/calendar" }
        if web.url?.path == "/admin/email" { return "/admin/email" }
        return "/studio-os/auth/callback"
    }
    private func beginAuthentication(_ url: URL, callbackPath: String) {
        guard authSession == nil else { return }
        guard #available(iOS 17.4, *), Bundle.main.object(forInfoDictionaryKey: "STUDIO_NATIVE_OAUTH_ENABLED") as? Bool == true, configuration.webURL.scheme == "https", let host = configuration.webURL.host else {
            alert("Google and Apple connections require the app’s HTTPS callback and associated-domain setup. This build has not enabled that connection. You can sign in with email and password.") { [weak self] in self?.web.reload() }; return
        }
        let current = identity
        let session = ASWebAuthenticationSession(url: url, callback: .https(host: host, path: callbackPath)) { [weak self] callback, error in
            DispatchQueue.main.async {
                guard let self, self.identity == current else { return }; self.authSession = nil
                if let callback, self.trusted(callback), callback.path == callbackPath { self.web.load(URLRequest(url: callback)) }
                else { self.web.reload(); if error != nil { self.alert("The connection was cancelled or could not finish. You can try again.") } }
            }
        }
        session.presentationContextProvider = self; session.prefersEphemeralWebBrowserSession = false; authSession = session
        if !session.start() { authSession = nil; alert("The secure sign-in window could not open. Please retry.") { [weak self] in self?.web.reload() } }
    }
    func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor { view.window ?? ASPresentationAnchor() }
    private func approvedMessage(_ message: WKScriptMessage) -> Bool {
        let origin = message.frameInfo.securityOrigin
        let port = origin.port == 0 ? (origin.protocol == "https" ? 443 : 80) : origin.port
        let base = configuration.webURL
        guard let source = message.webView, source === web || source === previewWeb else { return false }
        return message.frameInfo.isMainFrame && origin.protocol == base.scheme && origin.host.lowercased() == base.host?.lowercased() && port == (base.port ?? (base.scheme == "https" ? 443 : 80)) && source.url.map(trusted) == true
    }
    private func bridgeFailure(_ text: String) -> Error { NSError(domain: "StudioOSBridge", code: 1, userInfo: [NSLocalizedDescriptionKey: text]) }
    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage, replyHandler: @escaping (Any?, String?) -> Void) {
        guard approvedMessage(message), let body = message.body as? [String: Any], let type = body["type"] as? String else { replyHandler(nil, "This website cannot use the app bridge."); return }
        let sensitive = ["privacyLock", "requestNotifications", "openSystemSettings", "documentStart", "documentChunk", "documentEnd", "print", "share"]
        if sensitive.contains(type), (StudioDeviceFeatures.shared.isLocked || UIApplication.shared.applicationState != .active) {
            replyHandler(nil, "Unlock Studio OS and return to the app to continue."); return
        }
        do {
            switch type {
            case "deviceStatus":
                Task { @MainActor in replyHandler(await StudioDeviceFeatures.shared.status(), nil) }; return
            case "privacyLock":
                guard let enabled = body["enabled"] as? Bool else { throw bridgeFailure("Choose a valid privacy setting.") }
                Task { @MainActor in
                    do { replyHandler(try await StudioDeviceFeatures.shared.setPrivacyLock(enabled), nil) }
                    catch { replyHandler(nil, error.localizedDescription) }
                }; return
        case "disconnectNotifications":
            Task { @MainActor in replyHandler(await StudioDeviceFeatures.shared.disconnectNotifications(), nil) }; return
            case "requestNotifications":
                Task { @MainActor in
                    do { replyHandler(try await StudioDeviceFeatures.shared.requestNotifications(), nil) }
                    catch { replyHandler(nil, error.localizedDescription) }
                }; return
            case "openSystemSettings":
                if let url = URL(string: UIApplication.openSettingsURLString) { UIApplication.shared.open(url) }
            case "workspaceContext":
                guard let userId = body["userId"] as? String, let workspaceKey = body["workspaceKey"] as? String else { throw bridgeFailure("Choose a signed-in studio.") }
                StudioDeviceFeatures.shared.setContext(userId: userId, workspaceKey: workspaceKey)
            case "appearance":
                let mode = body["mode"] as? String
                overrideUserInterfaceStyle = mode == "dark" ? .dark : mode == "light" ? .light : .unspecified
                setNeedsStatusBarAppearanceUpdate()
            case "contextChanged":
                StudioDeviceFeatures.shared.clearContext()
                identity = UUID(); authSession?.cancel(); authSession = nil; cancelFiles(); closePreview()
                UIPrintInteractionController.shared.dismiss(animated: false); presentedViewController?.dismiss(animated: false)
            case "documentStart":
                guard blob == nil, let id = body["id"] as? String, UUID(uuidString: id) != nil, let size = body["size"] as? Int, size >= 0, size <= maximumBytes else { throw bridgeFailure("Another download is active, or this file exceeds 50 MB.") }
                let url = try destination(body["filename"] as? String ?? "Studio-OS-file")
                do {
                    guard FileManager.default.createFile(atPath: url.path, contents: nil, attributes: [.protectionKey: FileProtectionType.complete]) else { throw bridgeFailure("The file could not be created.") }
                    blob = PendingDocument(id: id, url: url, size: size, handle: try FileHandle(forWritingTo: url))
                } catch { removeDocument(url); throw error }
            case "documentChunk":
                guard fileOperation == nil, let pending = blob, body["id"] as? String == pending.id,
                      let index = body["index"] as? Int, index == pending.index,
                      let encoded = body["data"] as? String, encoded.utf8.count <= 270_000 else { throw bridgeFailure("The file transfer could not be verified.") }
                let operation = UUID(), generation = fileGeneration
                fileOperation = operation
                fileQueue.async {
                    let result: Result<Int, Error> = Result {
                        guard let bytes = Data(base64Encoded: encoded), bytes.count <= 192 * 1024,
                              pending.received + bytes.count <= pending.size else {
                            throw NSError(domain: "StudioOSBridge", code: 1, userInfo: [NSLocalizedDescriptionKey: "The file transfer could not be verified."])
                        }
                        try pending.handle.write(contentsOf: bytes)
                        return bytes.count
                    }
                    DispatchQueue.main.async {
                        guard self.fileGeneration == generation, self.fileOperation == operation, self.blob?.id == pending.id else {
                            replyHandler(nil, "The document changed. Download cancelled."); return
                        }
                        self.fileOperation = nil
                        switch result {
                        case .success(let count):
                            var next = pending; next.received += count; next.index += 1; self.blob = next; replyHandler(true, nil)
                        case .failure(let error): replyHandler(nil, error.localizedDescription)
                        }
                    }
                }
                return
            case "documentEnd":
                guard fileOperation == nil, let pending = blob, body["id"] as? String == pending.id, pending.received == pending.size else { throw bridgeFailure("This file did not finish downloading. Please retry.") }
                try pending.handle.close(); blob = nil
                try share([pending.url], file: pending.url, completion: { completed in replyHandler(completed ? true : nil, completed ? nil : "Sharing was cancelled.") }); return
            case "documentAbort":
                if let pending = blob, body["id"] as? String == pending.id { blob = nil; fileOperation = nil; fileQueue.async { try? pending.handle.close() }; removeDocument(pending.url) }
            case "print":
                guard UIPrintInteractionController.isPrintingAvailable else { throw bridgeFailure("Printing is unavailable on this device.") }
                let printer = UIPrintInteractionController.shared, info = UIPrintInfo(dictionary: nil)
                let source = message.webView ?? web!
                info.jobName = source.title ?? "Studio OS"; info.outputType = .general; printer.printInfo = info; printer.printFormatter = source.viewPrintFormatter()
                if traitCollection.userInterfaceIdiom == .pad { let host = presentationHost; printer.present(from: CGRect(x: host.view.bounds.midX, y: host.view.safeAreaInsets.top, width: 1, height: 1), in: host.view, animated: true, completionHandler: nil) }
                else { printer.present(animated: true, completionHandler: nil) }
            case "share":
                let text = body["text"] as? String ?? "", title = body["title"] as? String ?? "", rawURL = body["url"] as? String ?? ""
                guard text.count <= 10_000, title.count <= 200, rawURL.count <= 2048 else { throw bridgeFailure("This share is too large.") }
                var items: [Any] = []
                if !title.isEmpty { items.append(title) }; if !text.isEmpty { items.append(text) }
                if !rawURL.isEmpty {
                    guard let url = URL(string: rawURL, relativeTo: configuration.webURL)?.absoluteURL, ["http", "https"].contains(url.scheme ?? ""), url.user == nil, url.password == nil else { throw bridgeFailure("This link cannot be shared.") }
                    items.append(url)
                }
                guard !items.isEmpty else { throw bridgeFailure("There is nothing to share.") }
                try share(items, completion: { completed in replyHandler(completed ? true : nil, completed ? nil : "Sharing was cancelled.") }); return
            default: throw bridgeFailure("This app action is unavailable.")
            }
            replyHandler(true, nil)
        } catch { replyHandler(nil, error.localizedDescription) }
    }
    private func destination(_ proposed: String) throws -> URL {
        guard directories.count < 8 else { throw bridgeFailure("Close the current downloads before starting another.") }
        var name = URL(fileURLWithPath: proposed).lastPathComponent.replacingOccurrences(of: "[^A-Za-z0-9._ -]", with: "-", options: .regularExpression)
        name = String(name.prefix(120)); if name.isEmpty || name.hasPrefix(".") { name = "Studio-OS-file" + (name.hasSuffix(".pdf") ? ".pdf" : "") }
        var folder = FileManager.default.temporaryDirectory.appendingPathComponent("StudioOS-" + UUID().uuidString, isDirectory: true)
        try FileManager.default.createDirectory(at: folder, withIntermediateDirectories: false, attributes: [.protectionKey: FileProtectionType.complete])
        var values = URLResourceValues(); values.isExcludedFromBackup = true; try folder.setResourceValues(values); directories.insert(folder)
        return folder.appendingPathComponent(name, isDirectory: false)
    }
    private func removeDocument(_ url: URL) {
        let folder = url.deletingLastPathComponent()
        if directories.remove(folder) != nil { fileQueue.async { try? FileManager.default.removeItem(at: folder) } }
    }
    private func share(_ items: [Any], file: URL? = nil, completion: ((Bool) -> Void)? = nil) throws {
        let host = presentationHost
        guard !StudioDeviceFeatures.shared.isLocked, UIApplication.shared.applicationState == .active, host.presentedViewController == nil else {
            if let file { removeDocument(file) }; throw bridgeFailure("Unlock the app and close the current dialog, then try sharing again.")
        }
        let sheet = UIActivityViewController(activityItems: items, applicationActivities: nil)
        sheet.popoverPresentationController?.sourceView = host.view
        sheet.popoverPresentationController?.sourceRect = CGRect(x: host.view.bounds.midX, y: host.view.bounds.midY, width: 1, height: 1)
        activeShareCompletion = { [weak self] completed in if let file { self?.removeDocument(file) }; completion?(completed) }
        sheet.completionWithItemsHandler = { [weak self] _, completed, _, _ in self?.finishShare(completed) }
        host.present(sheet, animated: true)
    }
    private func finishShare(_ completed: Bool) {
        let completion = activeShareCompletion; activeShareCompletion = nil; completion?(completed)
    }
    private func cancelFiles() {
        fileGeneration = UUID(); fileOperation = nil
        finishShare(false)
        let pending = blob; blob = nil
        for (_, item) in downloads { item.0.cancel { _ in } }
        downloads.removeAll(); downloadGenerations.removeAll()
        let expired = directories; directories.removeAll()
        fileQueue.async {
            try? pending?.handle.close()
            for directory in expired { try? FileManager.default.removeItem(at: directory) }
        }
    }
    private func trackDownload(_ download: WKDownload) {
        guard downloadGenerations.count < 2 else { download.cancel { _ in }; return }
        downloadGenerations[ObjectIdentifier(download)] = fileGeneration; download.delegate = self
    }
    func webView(_ webView: WKWebView, navigationAction: WKNavigationAction, didBecome download: WKDownload) { trackDownload(download) }
    func webView(_ webView: WKWebView, navigationResponse: WKNavigationResponse, didBecome download: WKDownload) { trackDownload(download) }
    func download(_ download: WKDownload, decideDestinationUsing response: URLResponse, suggestedFilename: String, completionHandler: @escaping (URL?) -> Void) {
        guard downloadGenerations[ObjectIdentifier(download)] == fileGeneration else { completionHandler(nil); return }
        guard web.url.map(trusted) == true, response.url.map(trusted) == true, response.expectedContentLength >= 0, response.expectedContentLength <= Int64(maximumBytes), downloads.count < 2 else { downloadGenerations.removeValue(forKey: ObjectIdentifier(download)); completionHandler(nil); alert("This download needs a verified file size of 50 MB or less. Please retry from the studio’s download button."); return }
        do { let url = try destination(suggestedFilename); downloads[ObjectIdentifier(download)] = (download, url); completionHandler(url) }
        catch { downloadGenerations.removeValue(forKey: ObjectIdentifier(download)); completionHandler(nil); alert(error.localizedDescription) }
    }
    func download(_ download: WKDownload, willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest, decisionHandler: @escaping (WKDownload.RedirectPolicy) -> Void) { decisionHandler(request.url.map(trusted) == true ? .allow : .cancel) }
    func downloadDidFinish(_ download: WKDownload) {
        guard downloadGenerations.removeValue(forKey: ObjectIdentifier(download)) == fileGeneration else { return }
        guard let (_, url) = downloads.removeValue(forKey: ObjectIdentifier(download)) else { return }
        do {
            let attributes = try FileManager.default.attributesOfItem(atPath: url.path)
            guard let size = attributes[.size] as? NSNumber, size.intValue <= maximumBytes else { removeDocument(url); throw bridgeFailure("This file exceeds the 50 MB download limit.") }
            try FileManager.default.setAttributes([.protectionKey: FileProtectionType.complete], ofItemAtPath: url.path); try share([url], file: url)
        } catch { removeDocument(url); alert(error.localizedDescription) }
    }
    func download(_ download: WKDownload, didFailWithError error: Error, resumeData: Data?) {
        downloadGenerations.removeValue(forKey: ObjectIdentifier(download))
        guard let (_, url) = downloads.removeValue(forKey: ObjectIdentifier(download)) else { return }; removeDocument(url)
        if (error as NSError).code != NSURLErrorCancelled { alert("The download did not finish. Please retry.") }
    }
    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping () -> Void) {
        let host = presentationHost
        guard frame.isMainFrame, host.presentedViewController == nil else { completionHandler(); return }
        let dialog = UIAlertController(title: "Studio OS", message: String(message.prefix(2000)), preferredStyle: .alert)
        dialog.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() }); host.present(dialog, animated: true)
    }
    func webView(_ webView: WKWebView, runJavaScriptConfirmPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (Bool) -> Void) {
        let host = presentationHost
        guard frame.isMainFrame, host.presentedViewController == nil else { completionHandler(false); return }
        let dialog = UIAlertController(title: "Studio OS", message: String(message.prefix(2000)), preferredStyle: .alert)
        dialog.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completionHandler(false) }); dialog.addAction(UIAlertAction(title: "Continue", style: .default) { _ in completionHandler(true) }); host.present(dialog, animated: true)
    }
    func webView(_ webView: WKWebView, runJavaScriptTextInputPanelWithPrompt prompt: String, defaultText: String?, initiatedByFrame frame: WKFrameInfo, completionHandler: @escaping (String?) -> Void) {
        let host = presentationHost
        guard frame.isMainFrame, host.presentedViewController == nil else { completionHandler(nil); return }
        let dialog = UIAlertController(title: "Studio OS", message: String(prompt.prefix(2000)), preferredStyle: .alert); dialog.addTextField { $0.text = defaultText }
        dialog.addAction(UIAlertAction(title: "Cancel", style: .cancel) { _ in completionHandler(nil) }); dialog.addAction(UIAlertAction(title: "Continue", style: .default) { [weak dialog] _ in completionHandler(dialog?.textFields?.first?.text) }); host.present(dialog, animated: true)
    }
    func shutdown() {
        lifecycleObservers.forEach(NotificationCenter.default.removeObserver); lifecycleObservers.removeAll()
        privacyShield?.removeFromSuperview(); privacyShield = nil
        StudioDeviceFeatures.shared.clearContext()
        StudioDeviceFeatures.shared.onDeviceChange = nil; StudioDeviceFeatures.shared.onOpenNotification = nil
        identity = UUID(); authSession?.cancel(); authSession = nil; monitor.cancel(); observation = nil; cancelFiles(); closePreview()
        web?.stopLoading(); web?.navigationDelegate = nil; web?.uiDelegate = nil
        web?.configuration.userContentController.removeScriptMessageHandler(forName: "studioOS", contentWorld: .page)
    }
}
