# Studio OS Ultra — commercial iOS beta

This is the full shared Studio OS web interface in a native SwiftUI/WebKit app, with native privacy locking, document sharing/printing and optional notifications. It is not the old limited SwiftUI prototype.

The commercial backend has not passed release verification. Checked-in defaults do not connect to Team Alpha's personal production service. An unconfigured build shows a clear beta setup screen. Signing is blocked until explicit commercial endpoints and backend verification are supplied.

Start with [the beta release guide](../docs/IOS_BETA_RELEASE.md). The app requires iOS/iPadOS 17+, full Xcode, and an approved signing team for device distribution. No third-party Swift packages are required.

- Open `ios/StudioOS.xcodeproj`, scheme `StudioOS`.
- Debug-only local development: copy `Config/Local.example.xcconfig` to ignored `Config/Local.xcconfig`; use your disposable preview server.
- Release: use a private xcconfig based on `Distribution/CommercialBeta.example.xcconfig`. Never commit credentials, certificates or profiles.
- Validate: `node --test ios/Validation/*.test.cjs` and `bash ios/scripts/validate-native-config.sh`.
- Unsigned device compile: `xcodebuild -project ios/StudioOS.xcodeproj -scheme StudioOS -configuration Release -destination 'generic/platform=iOS' CODE_SIGNING_ALLOWED=NO build`.
- Archive only through the release guide. This source does not authorize deployment or TestFlight upload.

Google/Apple OAuth and APNs remain disabled until their commercial configuration and session/tenant behavior are verified. The linked website must provide account recovery/deletion, correct subscription behavior, privacy/support information and complete tenant isolation before distribution. Native build success does not verify these services.

`Preview/` is a disposable local fixture server for UI checks, not a production backend.
