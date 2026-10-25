# WhatsApp Business workspace

This branch adds the Studio OS inbox at `/admin/whatsapp`. It depends on the settings/integrations work in PR #7. It has not been deployed or connected to a real Meta account.

## Existing number and phone app

The studio requested that its existing WhatsApp Business number and phone app remain in use. Use Meta's supported Business app coexistence onboarding, subject to the actual account and provider's eligibility. Do not use ordinary number registration, migration, deregistration or account deletion as a substitute. This application does not implement those operations.

The owner can verify server configuration from Integrations or the inbox. Verification reads the WABA phone list and the selected phone's `is_on_biz_app` flag; sending fails closed unless the flag is explicitly true. This is a defensive check, not evidence that real coexistence onboarding or delivery has been certified. Account permissions, webhook subscriptions and actual inbound/outbound payloads must still be validated with the studio's Meta account before activation.

## Implemented behavior

- Protected shared inbox for saved current Studio OS administrators; owner-only connection verification.
- Search, cursor pagination, message history and conversation-specific unsent drafts. Visible-page polling pauses while hidden; abort/generation guards reject stale responses.
- Manual text replies within the server-derived 24-hour window. Starting outside it requires recorded client permission and a currently approved supported text template. No automated sending, reminders or broadcasts.
- Supported templates currently contain one BODY component with positional parameters. Media, headers, buttons and named parameters are deliberately excluded.
- Explicit links to existing contacts/enquiries, requiring an exact international phone match. New inbound senders stay in the WhatsApp inbox; no invented client email, automatic lead creation or record merging.
- Delivery states distinguish submitted, sent, delivered, read, failed and unknown. A provider acceptance is not a delivery receipt. Late callbacks advance monotonically; late Sent does not overwrite Failed.
- Request IDs and unique indexes prevent repeated submission of the same attempt. A timeout, HTTP 408 or ambiguous provider failure remains Unknown and is never automatically retried. A crashed Sending attempt ages to Unknown. Before another attempt, staff must check the Business app.
- Signed public webhook delivery is checked against the exact raw bytes with HMAC-SHA256. Normalized events persist before acknowledgment, support partial retries, deduplicate messages, and preserve orphan status events until their provider message ID is known.
- Local read state does not send provider read receipts. Media stays a plain-text placeholder; there are no media downloads or historical app backfills.
- Scoped Daylight/charcoal styles, phone list/detail navigation, accessible labels and shared Studio OS dialogs.

## Private backend configuration

Set these on the backend host, never in frontend/VITE variables or source control:

| Variable | Value |
| --- | --- |
| `WHATSAPP_ACCESS_TOKEN` | Appropriate server-side token for the selected business account and messaging permissions. |
| `WHATSAPP_APP_SECRET` | Secret for the Meta app receiving the webhooks. |
| `WHATSAPP_VERIFY_TOKEN` | Privately generated verification string, matching the webhook setup. |
| `WHATSAPP_PHONE_NUMBER_ID` | Meta phone-number ID for the existing coexisting Business app number. |
| `WHATSAPP_BUSINESS_ACCOUNT_ID` | Owning WABA ID. |
| `WHATSAPP_GRAPH_VERSION` | Explicit supported version, in `vNN.N` format. Confirm the selected version's coexistence fields with current Meta documentation. |
| `API_PUBLIC_URL` | Canonical public HTTPS backend origin. The UI derives the callback below from it. |

Callback: `https://<backend>/api/integrations/whatsapp/webhook`.

Complete supported coexistence onboarding with the studio's Meta Business Portfolio before supplying production credentials. Configure the app's supported message/status webhook subscriptions for this WABA and verify the callback with the matching token. Real Business app echo field/subscription shapes remain an activation dependency: the parser accepts bounded defensive fixtures, but live echoes have not been certified. Do not promise app-history synchronization. No opaque callback correlation or phone/time guesses are used to claim an ambiguous send succeeded.

All Graph calls use the fixed HTTPS Meta Graph origin, no redirects, explicit API version, bounded responses and a timeout. GET operations verify accounts/templates; the only provider write supported by the service is an explicit messages POST. Tokens are not stored in the new database models, returned in DTOs, embedded in links or logged by this feature. No credentials have been created, copied or submitted during implementation.

## Data and operational limits

The four new MongoDB models are `WhatsAppConnection`, `WhatsAppConversation`, `WhatsAppMessage` and `WhatsAppReceipt`. Their required indexes are included in startup readiness before APIs accept traffic. Existing records and authentication are preserved. WhatsApp content is team-shared; Gmail remains private to each connected administrator.

The existing in-app recovery export allowlist does not include WhatsApp messages/connections/receipts. Use managed full-database backups for this data and establish the studio's retention policy before production use. No purging or irreversible deletion is introduced by this branch.

Meta/provider charges and onboarding requirements must be reviewed with the actual account. No paid provider, billing agreement or new access has been enabled. A real end-to-end test requires approved private configuration, signed inbound delivery, a deliberate test reply to an authorised test recipient and observed delivery callbacks. None has occurred yet.

## Validation

- Backend suite: **260 passing**, including 22 isolated WhatsApp service tests and 12 route tests.
- Frontend suite: **112 passing**, including seven WhatsApp helper tests.
- Studio, public and mobile ESLint scopes: pass.
- Production Vite build: pass, 3,480 modules. No new package dependencies.
- Browser QA uses a separate disposable API/process and clearly labelled DEMO conversations; it cannot call Meta or send messages. Checked charcoal laptop, phone list/detail/back navigation, closed-window template controls, permission dialog, Daylight tablet and wide-desktop widths. No document overflow at 320, 390, 834, 1,440 or 2,560 CSS px. Resizing is simulation, not physical-device certification.
- Real credentials, Meta coexistence, echo payloads, historical import and real delivery remain unverified. Main local preview and client smart-link preview processes were preserved.

## Changed files

Backend: `.env.example`, `server.js`, `models/WhatsAppConnection.js`, `models/WhatsAppConversation.js`, `models/WhatsAppMessage.js`, `models/WhatsAppReceipt.js`, `routes/whatsappRoutes.js`, `services/whatsappService.js`, `tests/whatsapp-routes.test.js`, `tests/whatsapp-service.test.js`.

Frontend: `package.json`, `src/App.jsx`, `src/admin/components/common/Sidebar.jsx`, `src/admin/components/common/Topbar.jsx`, `src/admin/components/settings/SettingsEditor.jsx`, `src/admin/components/integrations/WhatsAppConnectionCard.jsx`, `src/admin/pages/Integrations.jsx`, `src/admin/pages/WhatsAppInbox.jsx`, `src/admin/pages/whatsappInbox.css`, `src/utils/whatsappData.js`, `test/whatsapp-data.test.mjs`.

Documentation: `docs/WHATSAPP_BUSINESS.md`. Disposable `.vite/` QA fixture and generated `dist/` are ignored and not part of the change.

## Primary references

- [WhatsApp Business Platform](https://business.whatsapp.com/products/business-platform)
- [Meta Embedded Signup reference](https://www.postman.com/meta/whatsapp-business-platform/documentation/du6gzjv/embedded-signup)
- [Meta Business app onboarding guide](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users/) — account access/current documentation must be checked during activation; automated retrieval returned HTTP 429 during implementation.
- [Official Meta OpenAPI repository](https://github.com/facebook/openapi)
- [Official WhatsApp webhook signature reference](https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/webhooks/start/) — reference only; its archived SDK was not added.

Production publication remains paused. Do not merge or deploy this branch without the studio's explicit approval.
