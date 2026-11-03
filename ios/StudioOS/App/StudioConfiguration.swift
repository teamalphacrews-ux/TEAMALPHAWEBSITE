import Foundation

/// Immutable build configuration. No runtime server picker or embedded credentials.
struct StudioConfiguration {
    let apiURL: URL
    let webURL: URL
    var startPath = "/studio-os/login"
    var backendVerified = false
    var releaseChannel = "beta"
    var allowsLocalHTTP = false
    var debugBuild = false

    static let current: StudioConfiguration = {
        let info = Bundle.main.infoDictionary ?? [:]
        let fallback = URL(string: "https://unconfigured.invalid")!
        var value = StudioConfiguration(
            apiURL: URL(string: info["STUDIO_API_URL"] as? String ?? "") ?? fallback,
            webURL: URL(string: info["STUDIO_WEB_URL"] as? String ?? "") ?? fallback,
            startPath: info["STUDIO_START_PATH"] as? String ?? "",
            backendVerified: (info["STUDIO_COMMERCIAL_BACKEND_VERIFIED"] as? Bool) == true || (info["STUDIO_COMMERCIAL_BACKEND_VERIFIED"] as? String) == "true",
            releaseChannel: info["STUDIO_RELEASE_CHANNEL"] as? String ?? ""
        )
        #if DEBUG
        value.debugBuild = true
        value.allowsLocalHTTP = true
        #endif
        return value
    }()

    private func validOrigin(_ url: URL) -> Bool {
        guard let scheme = url.scheme?.lowercased(), let host = url.host?.lowercased(),
              url.user == nil, url.password == nil, url.query == nil, url.fragment == nil,
              ["", "/"].contains(url.path), !host.hasSuffix(".") else { return false }
        if debugBuild && allowsLocalHTTP && scheme == "http" {
            let parts = host.split(separator: ".").compactMap { Int($0) }
            return host == "localhost" || host == "::1" || (parts.count == 4 && parts.allSatisfy { (0...255).contains($0) } &&
                (parts[0] == 127 || parts[0] == 10 || (parts[0] == 192 && parts[1] == 168) || (parts[0] == 172 && (16...31).contains(parts[1]))))
        }
        guard scheme == "https", url.port == nil || url.port == 443 else { return false }
        let forbidden = ["invalid", "test", "example", "local", "localhost", "lan", "internal", "home", "corp", "onion", "example.com", "example.net", "example.org", "teamalpha.photography", "team-alpha-studio.onrender.com", "team-alpha-api.onrender.com"]
        guard !forbidden.contains(where: { host == $0 || host.hasSuffix("." + $0) }) else { return false }
        let labels = host.split(separator: ".", omittingEmptySubsequences: false)
        return labels.count >= 2 && labels.last?.rangeOfCharacter(from: .letters) != nil && labels.allSatisfy {
            !$0.isEmpty && $0.count <= 63 && !$0.hasPrefix("-") && !$0.hasSuffix("-") && $0.range(of: "^[a-z0-9-]+$", options: .regularExpression) != nil
        }
    }

    var validationError: String? {
        guard validOrigin(webURL), validOrigin(apiURL) else {
            return "This beta needs its commercial Studio OS server configured. Your personal Team Alpha website is kept separate."
        }
        guard releaseChannel == "beta" else { return "This build requires the commercial beta release configuration." }
        if debugBuild {
            guard ["/studio-os/login", "/native-preview/start"].contains(startPath) else { return "Choose the commercial login or disposable development preview." }
        } else {
            guard startPath == "/studio-os/login", backendVerified else {
                return "The commercial Studio OS backend has not been verified for this beta. Distribution remains paused until verification is complete."
            }
        }
        return nil
    }

    var startURL: URL { URL(string: startPath, relativeTo: webURL)?.absoluteURL ?? webURL }
}
