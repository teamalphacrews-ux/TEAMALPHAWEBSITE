# Studio OS mobile workflow upgrade — local review

The shared responsive app now includes:
- Today and Insights views, optional inspiration/activity strip, saved card customization and larger text.
- Overview, Enquiries, Projects, Calendar and More bottom tabs; Finance can replace Projects in personal preferences.
- One Add menu and grouped search of actual contacts, projects, enquiries, quotations and invoices.
- Project tabs for overview, documents, payments, crew and delivery, using existing records and explicit IDs.
- Shoot Day with studio-timezone scheduling, directions, client/crew contacts and the existing project checklist.
- Private expense receipt photos, optional project association, image resizing and metadata removal.
- Enquiry insights and finance charts below the primary records; templates live inside Quotations and earlier bookings remain available from Projects.
- Account/studio-scoped encrypted local drafts for new enquiries, quotations and project notes. Restore/discard is explicit. There is no automatic submission/replay.

## Offline boundaries

Drafts use non-extractable AES-GCM keys in IndexedDB, expire after seven days and are cleared on logout or workspace changes. Each studio is limited to 50 drafts of 128 KiB each. Credentials, cloud-folder passwords and payment status/deposit changes are excluded. Local storage protects the saved bytes but does not defend against a compromised browser origin.

The app must already be loaded to keep working through a dropped connection. It does not cache the full app shell, client records, mailbox or documents for cold offline launch. A request whose result is unknown is marked accordingly; users must check records before retrying a create. Nothing is automatically sent when connectivity returns.

## Apple configuration

Face ID/Touch ID/device-passcode privacy locking is implemented in Swift. Device Settings accurately disables native-only controls in an ordinary browser.

Apple push is disabled by default. Enable the owned app identifier's Push Notifications capability in Xcode, set CODE_SIGN_ENTITLEMENTS to Config/StudioOS.entitlements, STUDIO_PUSH_ENABLED=true, and STUDIO_APNS_ENVIRONMENT to development or production to match signing.

The backend needs APNS_ENABLED=true, APNS_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID, APNS_PRIVATE_KEY and a stable PUSH_TOKEN_SECRET of at least 32 characters (or a suitable existing VAULT_SECRET). APNS_SANDBOX must match the signed build. These private values belong only on the backend. No secrets have been generated or changed by this task.

Push opt-in is per account/studio on the device. Registration is encrypted and bound to the authenticated user, workspace and server session; delivery rechecks membership, session expiry, categories and quiet hours. Lock-screen content is generic. Notification taps open matching, allowlisted records. Disconnect remains off until enabled again. In-app notifications remain available if push delivery fails; a durable provider retry queue is outside this implementation.

New Google/Apple authorization still needs the existing native external-auth callback setup documented in ios/README.md. Existing connected integrations use the same backend.

## Validation and remaining device work

Local validation: production frontend build; targeted ESLint; 175 frontend tests; 360 backend tests; 5 native bridge tests; Swift source parsing; and plist/entitlement validation. Browser checks covered 320px and 390px phone layouts and 1024px tablet and 1440px desktop layouts, grouped record search, local enquiry draft restore/submission, project crew assignment, task completion, Shoot Day and App & device Settings. These checks do not substitute for physical-device testing. The browser preview exercises real React screens against disposable in-memory sample records, not production data.

This Mac lacks full Xcode and an iOS SDK. Native signing, installation, Face ID, APNs delivery, camera/file-picker behavior, VoiceOver, background lifecycle and physical-device performance remain unverified until tested in Xcode and on an iPhone. This is not an App Store/TestFlight release.

The changes are local and unpublished.
