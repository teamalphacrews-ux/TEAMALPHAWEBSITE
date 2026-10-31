# Studio OS commercial iOS beta

Native beta preparation only. The commercial SaaS backend remains unverified. No signed IPA, TestFlight upload or App Store release is claimed. This branch adds the full-interface native app to the reviewed release base; it does not import the dirty/unverified SaaS backend or deploy Team Alpha's personal website.

## Prepared

Complete hosted Studio OS interface inside SwiftUI/WebKit, native privacy locking, optional notifications, protected document sharing/printing, strict HTTPS release configuration, native configuration tests, release preflight, unsigned CI build and local archive/export templates.

Checked-in defaults use reserved domains and backend verification=false. An unconfigured app shows a clear setup screen instead of connecting to a personal studio. No credentials, certificates or profiles belong in the repository.

The privacy manifest declares app-local UserDefaults and expected studio data categories. Verify it against the final commercial backend/integrations and complete App Store Connect privacy disclosures before submission. It is not a finished privacy/legal assessment.

## Commercial backend acceptance before signing

Record environment, commit, date, accountable owner, tester and evidence for each item before setting STUDIO_COMMERCIAL_BACKEND_VERIFIED=true. This flag records a human decision; preflight does not prove remote behavior.

- Owned HTTPS website/API with commercial sign-in at /studio-os/login.
- Real two-studio testing: signup/login, invitations, owner/admin/staff authorization, tenant switching, session expiry/logout, recovery and account deletion. Record IDs, API requests, media and Smart Links must never cross tenants.
- Quotes, acceptance, issued invoices, schedules, client payments, projects, crew, post-production and exports work in disposable studios.
- Monitoring, capacity, rate limits, backups, restore and rollback have recorded results/owners.
- Integrations work independently per studio. Keep Google/Apple native OAuth disabled until owned callbacks, browser proof and original-session handoff pass real-device tests.
- Keep APNs disabled until signed capability/profile, per-user/studio registration, delivery, opt-out and logout isolation are verified.
- Privacy/support destinations and retention/deletion policy match actual behavior.
- Review subscriptions against Apple rules. Razorpay website checkout is not automatically an approved in-app digital subscription flow. Client payment for physical photography services is a separate use case.
- Accurate metadata, live review backend and reviewer access; no unfinished onboarding or misleading integration promises.

Primary references: [App Review](https://developer.apple.com/app-store/review/guidelines/), [privacy manifests](https://developer.apple.com/documentation/bundleresources/privacy-manifest-files), [account deletion](https://developer.apple.com/help/app-review/guideline-reference/5-1-1-account-deletion/). Review these again before submission.

## Automated validation

Full Xcode and Node are required. On this managed Mac, direct Swift compiler checks work but Xcode DerivedData writes were blocked. Use approved personal Mac Studio or CI for full builds; do not bypass MDM.

~~~sh
node --test ios/Validation/*.test.cjs
bash ios/scripts/validate-native-config.sh
xcodebuild -project ios/StudioOS.xcodeproj -scheme StudioOS -configuration Release \
  -destination 'generic/platform=iOS' -derivedDataPath Build/DerivedData CODE_SIGNING_ALLOWED=NO build
~~~

Tests execute actual bridge and native configuration policy plus release validation with mocked DNS. They do not replace API or installed-device acceptance. CI compiles the actual app unsigned.

Debug local UI: copy ios/Config/Local.example.xcconfig to ignored Local.xcconfig, set approved disposable LAN preview origins, use /native-preview/start. Local HTTP is confined to Debug/private origins. Release has no ATS exceptions.

## Archive and handoff on personal Mac Studio

Use an approved Apple Developer team, registered beta bundle identifier, unique build number and matching signing profile. Copy ios/Distribution/CommercialBeta.example.xcconfig outside version control, configure owned HTTPS endpoints, and retain verification=false until backend acceptance is complete.

~~~sh
node ios/scripts/release-preflight.cjs --xcconfig /absolute/path/CommercialBeta.xcconfig
node ios/scripts/release-preflight.cjs --archive --team YOURTEAMID \
  --xcconfig /absolute/path/CommercialBeta.xcconfig \
  --archive-path /absolute/path/StudioOS-beta-001.xcarchive
~~~

Preflight checks resolved Release settings, strict ATS, commercial origins and public DNS without API requests. Xcode signed archives repeat the gate before compilation. Set STUDIO_NODE_BINARY to an absolute Node path if Xcode cannot find Node. Never bypass the gate. The wrapper verifies final settings/signature; it does not create credentials, update provisioning or upload.

After installed-device acceptance, export locally:

~~~sh
xcodebuild -exportArchive -archivePath /absolute/path/StudioOS-beta-001.xcarchive \
  -exportPath /absolute/path/StudioOS-beta-001-export \
  -exportOptionsPlist ios/Distribution/ExportOptions-TestFlight.plist
~~~

The template exports for internal TestFlight only and does not upload. Preserve archive, dSYMs, logs and device test records. Upload, tester invitations and external beta submission remain separate actions.

## Physical-device acceptance

Record build, device/OS, tester, evidence and result. Use disposable commercial accounts, small/large iPhones and iPad, minimum iOS17 and a current supported OS.

- Cold launch, relaunch, upgrade, offline/TLS/server errors and retry.
- Sign-in, expiry, user/tenant switch, logout and forbidden direct links. No private file/page/notification/identity crosses transitions.
- Every main module and nested settings: creation/editing, validation, cancellation, both themes.
- Keyboard, safe areas, rotation, large text, VoiceOver, bottom navigation and last-row reachability.
- Same-origin preview closes back to original workspace. Foreign content cannot invoke privileged bridge actions.
- Camera/photo/Files permission denial, exports at/over size limit, sharing/printing and cancellation on both device families.
- Background/reload/tenant switch during transfer; no stuck or stale document sharing after retry.
- Privacy lock, background during authentication, cancelled unlock, app-switcher snapshots and disable-lock authentication.
- Enabled APNs denial/opt-out/expired registration/wrong user/wrong tenant/locked app/taps.
- Enabled OAuth returns to originating session. Mail/telephone/payment handoffs return cleanly.
- Support/privacy/deletion and subscription flows match final disclosures.

Outstanding or failed checks remain release blockers. Browser previews do not replace physical-device evidence.

## Preparation evidence

Local Xcode27.2 / SDK27.2: actual native app Swift sources pass iOS17 arm64 typechecking after the WebKit/lifecycle changes. Foundation configuration harness: 49 runtime checks passed. Bridge and release-policy regressions: 20 passed. Property lists/project syntax: valid. Full local Xcode build was blocked by sandbox writes to DerivedData/info.plist, so no local full app build or IPA is claimed. CI full-build evidence is recorded on the review PR. Commercial backend, signing, new physical-device regression, TestFlight and App Review remain outstanding.
