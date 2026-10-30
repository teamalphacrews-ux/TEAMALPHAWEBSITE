# WhatsApp Business workspace

This branch adds the Studio OS WhatsApp workspace at `/admin/whatsapp`, with separate Meta inbox and Wabb manual-submission modes. It depends on the settings/integrations work in PR #7. It has not been deployed or connected to a provider from Studio OS.

## Existing Wabb account

The studio now uses Wabb. Its signed-in Wabb connection screen showed the studio number Connected with a Green quality rating. That observation does not mean Studio OS is connected. Preserve this existing connection; do not rerun number registration, migration or removal. Existing Wabb API keys were not copied into Studio OS or Render, and no provider requests, sends, subscriptions or flow changes were made during implementation.

Set `WHATSAPP_PROVIDER=wabb` on the backend and configure these privately:

| Variable | Purpose |
| --- | --- |
| `WABB_API_KEY` | Existing Wabb Webhook API key; sent only in the server's `API-KEY` header to the fixed Wabb API origin. |
| `WABB_WORKSPACE_ID` | Numeric workspace ID observed in the studio's Wabb console. |
| `WABB_PHONE_NUMBER` | Full international studio number including `+`, matching the existing Wabb connection. This is operator-supplied metadata, not API verification of the sender. |

The owner-only verification reads the first subscriber page from `https://api.wabb.in/api/v1/webhook/subscribers/?page=1`, validates the response and discards its contact data. Only verification metadata/fingerprint is retained. The UI says **API ready**, never **phone connected** or **inbox synced**. Verification expires after 24 hours and changing credentials invalidates it.

Manual text submission resolves an existing Wabb subscriber by full international phone and requires an exact response phone match. Missing/ambiguous numbers fail closed without guessing a country code, using `ddd`, adding contacts or changing the outside-audience setting. Staff must confirm the client permits the message and has messaged within the reply window. These are staff attestations; Studio OS cannot independently verify Wabb's window. Wabb enforces provider restrictions; use Wabb's approved-template UI outside the active window.

The only Wabb write implemented is a deliberate `POST /webhook/subscriber/{id}/send_message/` with `{type:"text",value:"…"}`. Quotes, invoices and smart-client URLs may be pasted into that plain-text message. A documented HTTP 200 with `{}` means **Submitted to Wabb**, not Sent/Delivered/Read. A timeout, HTTP 408, server error, malformed result or uncertain persistence stays **Delivery unconfirmed** and is never automatically retried. A durable unique workspace/request ID claim precedes the POST; repeated requests do not resend. Resetting after an uncertain attempt requires staff to check Wabb. No broadcast, automatic reply, reminder, subscriber creation or message-status change is implemented.

Current public Wabb API documentation has no message-history API, supported approved-template sending contract or authenticated incoming/delivery/read callback contract. Wabb mode therefore does not poll the Meta inbox, create pretend incoming messages, import history or claim receipt statuses. Obtain supported trigger values, payloads, stable event IDs, authentication/signatures and retry semantics from Wabb before enabling two-way inbox synchronization. The Meta webhook remains exclusively Meta-signed and does not accept Wabb payloads.

For qualified enquiries, Wabb's Dynamic Integration Block supports custom HTTPS POSTs and authentication headers. It can target the existing `/api/webhooks/enquiries` endpoint with backend `ENQUIRY_WEBHOOK_SECRET` as Bearer authentication. Collect real name/email and supply a unique stable `event_id` or `Idempotency-Key` per enquiry, reused on retries. Optional fields are phone, eventType, eventDate (`YYYY-MM-DD`), eventLocation and notes. Do not invent an email, use a phone number as the sole enquiry ID, or export every chat as a new lead. This flow-to-CRM mapping remains unconfigured; no Wabb flow or shared secret was changed. Wabb's similarly named Webhook automation feature is the opposite direction (external system into Wabb) and is not an incoming-message stream.

Wabb's `WabbMessageAttempt` records are outside the existing in-app recovery export, like the WhatsApp collections below; include them in managed full-database backups. Index readiness includes their unique workspace/request ID index before traffic is served.

Primary Wabb references: [public API schema](https://api.wabb.in/swagger/?format=openapi), [existing Business app connection](https://help.wabb.in/en/articles/14151481-connect-to-official-api-using-whatsapp-business-app), [flow data export](https://help.wabb.in/en/articles/10505662-send-data-from-wabb-using-dynamic-integration-block). Older Wabb FAQs describe a different connection model; use the actual account settings and current API contract rather than assuming every Wabb account uses the same mode.

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

For direct Meta mode (`WHATSAPP_PROVIDER=meta`, also the default when omitted), set these on the backend host, never in frontend/VITE variables or source control. These Meta keys are not required for Wabb mode:

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

Backend: `.env.example`, `server.js`, `models/WhatsAppConnection.js`, `models/WhatsAppConversation.js`, `models/WhatsAppMessage.js`, `models/WhatsAppReceipt.js`, `models/WabbMessageAttempt.js`, `routes/whatsappRoutes.js`, `services/whatsappService.js`, `services/wabbService.js`, `tests/whatsapp-routes.test.js`, `tests/whatsapp-service.test.js`, `tests/wabb-service.test.js`.

Frontend: `package.json`, `src/App.jsx`, `src/admin/components/common/Sidebar.jsx`, `src/admin/components/common/Topbar.jsx`, `src/admin/components/settings/SettingsEditor.jsx`, `src/admin/components/integrations/WhatsAppConnectionCard.jsx`, `src/admin/pages/Integrations.jsx`, `src/admin/pages/WhatsAppInbox.jsx`, `src/admin/pages/WabbWorkspace.jsx`, `src/admin/pages/whatsappInbox.css`, `src/utils/whatsappData.js`, `test/whatsapp-data.test.mjs`.

Documentation: `docs/WHATSAPP_BUSINESS.md`. Disposable `.vite/` QA fixture and generated `dist/` are ignored and not part of the change.

## Primary references

- [WhatsApp Business Platform](https://business.whatsapp.com/products/business-platform)
- [Meta Embedded Signup reference](https://www.postman.com/meta/whatsapp-business-platform/documentation/du6gzjv/embedded-signup)
- [Meta Business app onboarding guide](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users/) — account access/current documentation must be checked during activation; automated retrieval returned HTTP 429 during implementation.
- [Official Meta OpenAPI repository](https://github.com/facebook/openapi)
- [Official WhatsApp webhook signature reference](https://whatsapp.github.io/WhatsApp-Nodejs-SDK/api-reference/webhooks/start/) — reference only; its archived SDK was not added.

Production publication remains paused. Do not merge or deploy this branch without the studio's explicit approval.
