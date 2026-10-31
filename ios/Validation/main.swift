import Foundation

var checks = 0
func check(_ condition: @autoclosure () -> Bool, _ message: String) {
    precondition(condition(), message); checks += 1
}
func config(_ web: String = "https://app.photography-studio.com", _ api: String = "https://api.photography-studio.com", verified: Bool = true, debug: Bool = false, start: String = "/studio-os/login") -> StudioConfiguration {
    StudioConfiguration(apiURL: URL(string: api)!, webURL: URL(string: web)!, startPath: start, backendVerified: verified, releaseChannel: "beta", allowsLocalHTTP: debug, debugBuild: debug)
}
check(config().validationError == nil, "Explicit beta accepts owned HTTPS origins")
check(config(verified: false).validationError != nil, "Release blocks unverified backend")
for endpoint in ["https://unconfigured.invalid", "https://localhost", "https://studio.test", "https://example.com", "https://sub.example.com", "https://teamalpha.photography", "https://team-alpha-api.onrender.com", "https://127.0.0.1", "https://192.168.1.2", "https://[::1]", "https://2130706433", "http://app.photography-studio.com", "https://user:password@app.photography-studio.com", "https://app.photography-studio.com/path", "https://app.photography-studio.com?q=1", "https://app.photography-studio.com/#secret", "https://app.photography-studio.com:444", "https://app.photography-studio.com."] {
    check(config(endpoint).validationError != nil, "Reject web: " + endpoint)
    check(config("https://app.photography-studio.com", endpoint).validationError != nil, "Reject api: " + endpoint)
}
for path in ["/auth", "//evil.com", "/admin", "/native-preview/start", "/studio-os/login?preview=1", "/studio-os/login#token"] {
    check(config(start: path).validationError != nil, "Release start route rejected")
}
let preview = config("http://192.168.29.63:5177", "http://127.0.0.1:5001", verified: false, debug: true, start: "/native-preview/start")
check(preview.validationError == nil, "Debug permits explicitly configured local preview")
check(preview.startURL.absoluteString == "http://192.168.29.63:5177/native-preview/start", "Preview stays on selected origin")
check(config("http://public-host.com", debug: true).validationError != nil, "Debug HTTP restricted to local development")
check(config().startURL.absoluteString == "https://app.photography-studio.com/studio-os/login", "Commercial start URL")
var production = config(); production.releaseChannel = "production"
check(production.validationError != nil, "Beta cannot claim production channel")
print("Native configuration: \(checks) checks passed")
