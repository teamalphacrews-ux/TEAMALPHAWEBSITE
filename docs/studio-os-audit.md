# Studio OS audit

Audit date: 2 November 2026 (Asia/Kolkata).

## Executive summary

**Status: Ready for additional staging validation.** The local repair set restores the enquiry-to-project-to-quotation entry points, strengthens safe retries and record linkage, repairs public studio-logo delivery, and refines the reported contact, document, date/time and settings layouts. It preserves the personal Team Alpha installation and leaves commercial SaaS paths gated.

The complete automated checks reported by the release owner passed: **232 frontend tests + 403 backend tests = 635 tests**, studio/public/mobile lint, and the production build. Chromium checks covered representative mobile, tablet, laptop and wide-desktop layouts plus local document/payment/support journeys. These checks do **not** establish physical Safari behavior, real MongoDB concurrency, provider connectivity, or production readiness without the staging gates below.

Draft review: [PR #16 — Team Alpha repair set](https://github.com/teamalphacrews-ux/TEAMALPHAWEBSITE/pull/16). The first five commits passed GitHub CI (run **41430758638**); commit 6 also passed (run **41431231142**). The dependency update is commit `23dbcabfabac5718ae3d28f349045f5d28af590a`; security/reminder/request-timeout refinements are commit `906288abd69ab20466b73cf048c5d350c061e9fb`. The final local build passed after commit 6. The PR checks are the authority for subsequent documentation/CI changes. Nothing in this audit authorizes or records a production deployment.

## Scope and evidence

This inventory covers personal Team Alpha frontend/backend source based on production commit `a3a89293413655367085163d1fa83dc940f86282` plus the current repair changes. Commercial SaaS and native release paths are separated below; their presence in source does not mean they are released.

Status meanings:

- **Verified via tests:** the stated behavior passed a named automated test in this audit. Provider/database calls in those tests are mocked unless stated otherwise.
- **Source-only:** implementation inspected; complete interactive behavior not verified.
- **External unverified:** requires real configuration, provider/account, deployed data or physical-device testing.
- **Missing:** the described capability is absent from the inspected flow.

This is not a claim that every button, production account, native entitlement or provider delivery has been tested. It is not a full real-MongoDB integration, external-provider or physical-device certification; no production deployment was performed for this inventory. This inventory caused no production database mutations, real transfers, customer messages or provider authorization grants. The release-owner validation matrix below records the additional local checks completed after this source inventory.

## Framework and package baseline

Exact versions below are recorded from the checked-in `frontend/package-lock.json` and `backend/package-lock.json`; package.json uses compatible ranges. They are a reproducibility baseline, not a vulnerability or production-runtime certification. The focused tests here used Node.js **24.19.0**. Both package manifests now require **Node >=22.22.0 <27**; the Express major remains **4**.

| Layer | Locked packages |
| --- | --- |
| Frontend application | React **19.3.1**, React DOM **19.3.1**, React Router DOM **7.18.5** |
| Frontend build/style | Vite **7.3.7**, React Vite plugin **5.2.0**, Tailwind CSS **3.4.19**, sharp **0.35.5** |
| Interface/media | Motion **12.43.0**, Lucide React **0.563.0**, Recharts **3.10.1**, FullCalendar React **6.1.22** |
| Frontend host/network | Express **4.22.3**, Axios **1.21.0** |
| Backend data/server | Express **4.22.3**, Mongoose **8.24.7**, Socket.IO **4.8.4** |
| Backend provider/security/upload | Nodemailer **10.3.1**, Google APIs **171.4.0**, Multer **2.5.0**, JSON Web Token **9.0.3**, node-cron **4.6.0** |

## Frontend routes, modules and actions

Routes: `frontend/src/App.jsx`. Menu: `admin/components/common/workspaceNavigation.js`, `Sidebar.jsx`, `Topbar.jsx`, `QuickCreate.jsx`. All paths below are browser paths.

| Route | Component / module | Action families found in source | Evidence status |
| --- | --- | --- | --- |
| `/` | `public/LuxuryHome.jsx`, `Hero.jsx` | Banner controls; stories/portfolio/films/collections; enquiry navigation | Source-only |
| `/portfolio` | `public/Portfolio.jsx` | Category selection; horizontal browsing; story/gallery viewer | Source-only |
| `/stories/:slug` | `public/StoryPage.jsx` | Story, image viewer, related films, enquiry | Source-only |
| `/films` | `public/Films.jsx` | Film browsing and playback | Source-only; media availability external unverified |
| `/studio`, `/collections`, `/locations/:slug` | `public/StudioPages.jsx` | Studio/service/location presentation and enquiry | Source-only |
| `/enquire` | `public/Enquiry.jsx` | Progressive form, validation/review, server submission/retry, email/WhatsApp alternatives | Source-only in this audit; production CRM receipt external unverified |
| `/privacy`, `/terms`, public unmatched route | `public/StudioPages.jsx` | Legal content and not-found navigation | Source-only; legal approval outside technical audit |
| `/auth` | `AuthPage.jsx`, `AuthContext.jsx` | Admin login, password visibility, return navigation/session verification | Verified via tests: session races/expiry and browser theme helpers; real credential sign-in external unverified |
| `/admin` | `admin/pages/Dashboard.jsx` | Today/Insights, date/event/enquiry links, complete task, refresh, customize/hide/restore/reorder cards | Verified via tests for safe record destinations; remaining actions source-only here |
| `/admin/crm` | `CRM.jsx`, `StudioLeadForm.jsx`, `StudioLeadDetails.jsx` | New/edit/filter/stage enquiry, follow-up, project/quote entry points, tasks/delivery/crew/invoice | Source-only for complete screen; release owner records enquiry repair verification |
| `/admin/studio-projects` | `StudioProjects.jsx` | Search/filter, new/open project, mobile records | Source-only |
| `/admin/studio-projects/:id` | `StudioProjectDetail.jsx`, `ProjectOperations.jsx` | Status/actions, documents/payments/crew/delivery, tasks/schedule, Smart Link | Source-only for whole screen; document/privacy behavior tested below |
| `/admin/quotations` | `Quotations.jsx` | Search/filter; blank/template quote; client/project; items/order/duplicate/delete; discount/tax; expiry/reminders; design/preview; save/email/schedule/link; lifecycle/history | Verified via tests for status, lifecycle, calculations, authorization, sharing, delivery-job safeguards and link recovery; responsive toolbar visual verification separate |
| `/admin/quote-templates`, `/admin/templates` | `QuoteTemplates.jsx` | Create/edit/remove reusable quote templates | Verified via tests for reusable settings and exclusion of client identity; full UI source-only |
| `/admin/invoices/new`, `/admin/invoices/:id` | `InvoiceWorkspace.jsx` | Create/edit issuer/logo/items/discount/tax; installments/dates/methods; approval; email/link/schedule; preview/PDF/duplicate/cancel/delete where permitted | Verified via tests for math/schedules/issuer snapshots/permissions/share gates/navigation; full UI and real delivery external unverified |
| `/admin/contacts` | `Contacts.jsx` | Search/filter, add/edit, open detail | Source-only |
| `/admin/contacts/:id` | `ContactDetail.jsx`, `ContactWorkflowUI.jsx`, `ContactRelatedTables.jsx` | Type/archive/restore/edit/note; create project/quote/invoice/session/message/contract/questionnaire; related records | Verified via tests for contact payment math; phone grouping/choice sheet visual verification separate |
| `/admin/calendar` | `Calendar.jsx`, `EventForm.jsx` | Month/agenda/date/filter; add/edit/delete event; crew; Google connect/status/sync/disconnect | Source-only; live Google authorization/sync external unverified |
| `/admin/shoot-day` | `ShootDay.jsx` | Choose day/refresh; event/project/calendar; directions/call/email; checklist completion/reopen | Source-only; device app handoffs external unverified |
| `/admin/finance` | `Finance.jsx` | Bookings/invoices/ledger; due queue; transaction/expense; receipt upload/view; booking receipt/invoice status; new invoice | Verified via tests for invoice balance/navigation helpers; financial mutations/reconciliation and receipt UI source-only here |
| `/admin/projects` | `Projects.jsx` | Production bookings; grid/list; date/payment/search filters; crew/checklist/balances; detail | Source-only |
| `/admin/crew` | `Crew.jsx` | Search/status/specialty; add/edit roster; assignments/scheduling/overlap review | Source-only |
| `/admin/post-production` | `PostProduction.jsx`, operations components | Task search/status/project/sort; create/edit/complete/delete; assign; delivery stages/links; templates | Source-only for whole UI; public-task visibility projection tested |
| `/admin/chats` | `ProjectSupport.jsx` | Project search/history/pagination/reply/read/unread | Verified via tests for scoping/projection/idempotency/limits/unread behavior; real client round-trip external unverified |
| `/admin/email` | `GmailInbox.jsx` | Connect/disconnect/status; Inbox/Sent/All mail; search/pagination/read | Source-only; consent/real Gmail account external unverified. Sending/archive/delete are missing from this read-only flow |
| `/admin/whatsapp` | `WhatsAppInbox.jsx`, `WabbWorkspace.jsx` | Manual sharing/provider workspace; provider setup/state and available conversation controls | Source-only; manual sharing is agreed mode. Provider send/history/delivery status external unverified |
| `/admin/integrations` | `Integrations.jsx`, integration cards | Gmail/WhatsApp state, Calendar destination, enquiry webhook status/instructions/copy | Source-only; provider/secret configuration external unverified |
| `/admin/data` | `DataManagement.jsx` | Storage/footage metadata search/filter/create/edit/archive and backup/location details | Source-only; catalogue is not proof of physical file backup |
| `/admin/offline-drafts` | `offline/OfflineDrafts.jsx` | List/continue/delete encrypted local drafts; explicit save/restore; seven-day expiry | Source-only here; physical-device storage behavior external unverified |
| `/admin/activity-log` | `ActivityLog.jsx` | Refresh/open notification; read/all-read; remove/clear activity | Source-only |
| `/admin/users` | `UserManagement.jsx` personal / `WorkspacePage` commercial | Owner-authorized team create/edit/remove, access status, self-removal protection | Source-only; no live account changes made |
| `/admin/settings` | `Settings.jsx`, settings components | Search, save/restore/discard, fourteen sections below | Source-only for complete editor; shared control/session mechanics tested |
| `/quote/:token` | `SharedQuotation.jsx`, `ClientProjectWorkspace.jsx` | Review/accept; project dashboard; invoice/payment plan/handoff; published production/team; accordion/support | Verified via tests for capabilities/acceptance/math/visibility; rendered physical-device journey external unverified |
| `/invoice/:token` | `PublicInvoice.jsx`, `ClientPaymentDialog.jsx` | Issued invoice, print/PDF, installments/payment instructions/UPI handoff | Verified via tests for projection and safe payment handoff; real transfer external unverified |
| `/quote-preview/:id` | Protected `SharedQuotation.jsx` | Owner preview, no acceptance | Verified via tests for authorization/public projection; rendered preview source-only |
| `/admin/clients`, `/portal/*`, `/admin/gallery/*`, `/quote` | Redirects | Contacts, home, studio-projects, public enquiry respectively | Source-only. No public client login/gallery portal route |
| `/native-preview/start` | `native/StudioPreview.jsx` | Explicit disposable preview | Verified via tests for device/development gating; DEV only |
| Commercial `/signup`, `/studio-os`, `/studio-os/login`, `/studio-os/auth/callback`, `/join/:token`, `/invite/:token`, `/admin/workspace`, `/admin/subscription` | `saas/*` | Product/signup/social login, invitation/workspace/team/plan | Source-only in this audit; DEV or `VITE_STUDIO_SAAS_ENABLED` gate; not personal production release |

Navigation/action system:

- Primary: Overview, Enquiries, Projects, Quotations, Contacts, Calendar, Shoot day, Finance.
- Operations: Crew & scheduling, Post production.
- Communication: Client support, Email, WhatsApp.
- Studio: Data & backups, Offline drafts, Activity, Integrations, Team & access; conditional Workspace & plan.
- Utilities: Settings, website shortcut, profile, record/page search, notifications and theme.
- Quick Create: Enquiry, Quotation, Invoice, Expense, Shoot.
- iPhone app/mobile Safari More navigation and iPad/desktop sidebar selection are verified via helper tests. Physical-device reachability remains external unverified.

## Settings inventory

Presence in source is not certification of all save paths, owner permissions or providers.

| Section id | Controls / scope | Status |
| --- | --- | --- |
| `workspace` | Daylight/dark gray/device, motion, overview visibility/order/reset/start page | Source-only editor; theme helper tests verified |
| `language` | Indian languages, region/timezone/date/time/numbers | Source-only |
| `notifications` | Sound/tone/volume, banners/badges/categories/quiet hours | Source-only; platform sound external unverified |
| `device` | Native lock/authentication, push status, system settings, drafts | External unverified for native capabilities; unsupported browser controls distinguished in source |
| `profile` | Name/legal name/GSTIN/photo/address/contact/WhatsApp/social | Source-only; release owner records upload repair validation |
| `branding` | Logo/cover/color/typography/preview | Source-only editor; per-document snapshot behavior tested |
| `billing` | Prefix/numbering/due interval/default amounts/tax/bank/UPI/milestones | Source-only editor; invoice/schedule validators tested |
| `automation` | Quote validity/auto invoice/reminders/team notifications | Source-only editor; quote reminder/acceptance job tests verified |
| `communication` | Sender/reply/message defaults/support hours/status/test | Source-only; SMTP delivery external unverified |
| `production` | Multiple templates/stages/categories/due days/default application | Source-only editor; public-task projection tested |
| `client` | Payment/crew/progress/deliverables/chat/link-expiry defaults | Server-side visibility snapshots tested; full UI source-only |
| `connections` | Gmail/Calendar/WhatsApp and channel navigation | External unverified |
| `security` | Owner policy, sessions, revoke access | Source-only editor; session helpers and public authorization tested |
| `backups` | Policy/retention/history/download/restore missing/recovery bin | Source-only; real restore/offsite disaster recovery external unverified |

## Backend route / data matrix

Mounts are from `backend/server.js`. Models below are direct references in each router; services may use further models. A tested router label covers only the behaviors documented later, not every handler.

| Router | Mount | Handler patterns (relative to mount) | Direct data references | Status |
| --- | --- | --- | --- | --- |
| adminUserRoutes.js | /api/admin-users | GET /; POST /create; PUT /:id; POST /update-master; DELETE /:id | AdminSession, AdminSettings, Lead, User | Source-only |
| auth.js | Not mounted (legacy duplicate; active auth is inline in server.js) | POST /register; POST /login; GET /google; GET /google/begin; GET /google/callback | User | Source-only |
| calendarRoutes.js | /api/calendar | GET /sync-status; GET /sync-now; POST /disconnect-google; GET /; POST /; PATCH /:id; DELETE /:id | Event, User | Source-only |
| chatRoutes.js | /api/chats | POST /; POST /upload; GET /; GET /admin/conversations; GET /search-users; GET /unread-summary; PUT /mark-as-seen; PUT /read; GET /unread; GET /admin/:userId; POST /clear/:userId; DELETE /clear-history; POST /clear/admin; POST /react/:messageId; DELETE /:id/:mode | ChatRoom, Message, User | Source-only |
| contactRoutes.js | /api | GET /contacts; POST /contacts; GET /contacts/:id; PATCH /contacts/:id; GET /studio-projects; POST /studio-projects; GET /studio-projects/:id; PATCH /studio-projects/:id/crew; PATCH /studio-projects/:id; POST /studio-projects/:id/notes; POST /contact-documents; PATCH /contact-documents/:id | ContactDocument, Event, Invoice, Lead, Photographer, Quotation, StudioContact, StudioProject | Source-only |
| dashboardRoutes.js | /api/dashboard | GET /studio-overview; GET /stats; GET /recent-activity; GET /upcoming-events | DriveGallery, Event, Finance, Gallery, GalleryEvent, Lead, Photographer, StudioConfig, Task, User | Source-only |
| documentCoverRoutes.js | /api/studio | POST /document-covers | Service-managed / no direct model import | Source-only |
| driveGalleryRoutes.js | /api/drive-gallery | GET /users/clients; POST /; POST /:clientId/events; GET /:clientId/events; GET /; GET /files/:eventId; GET /proxy/:fileId; DELETE /:id; GET /event/:eventId; POST /verify/search; POST /verify/:id; GET /:id; PATCH /:id; PATCH /events/:eventId; DELETE /events/:eventId | DriveGallery, GalleryEvent, Lead, User | Source-only |
| financeRoutes.js | /api/finance | GET /overview; GET /allocation; POST /; GET /transactions; POST /expense; PUT /expense/:id; DELETE /expense/:id; DELETE /income/:incomeType/:id; GET /pending-payments; GET /monthly-performance | Finance, Invoice, Lead, Notification | Source-only |
| galleryRoutes.js | /api/gallery | POST /upload; GET /; POST /; PATCH /:id/favorite; PATCH /:id/select; PATCH /:id/cover; PATCH /rename-folder; PATCH /rename-category; PATCH /:id; DELETE /:id; DELETE /folder/:folderName; DELETE /folder/:folderName/category/:categoryName | Event, Gallery, Notification | Source-only |
| gmailRoutes.js | /api/integrations/gmail | GET /begin; GET /callback; GET /status; POST /connect; POST /disconnect; GET /messages; GET /messages/:id | GmailConnection, GmailOAuthNonce, User | Source-only |
| googleSheetRoutes.js | /api/google-sheets | GET /; PUT /cell; PUT /batch-update; POST /row; POST /column; DELETE /row/:rowId; DELETE /column/:colIndex; GET /config/dropdowns; POST /config/dropdowns | SheetConfig | Source-only |
| invoiceRoutes.js | /api/invoices | GET /; GET /delivery-status; POST /; GET /:id; PUT /:id; POST /:id/approve; POST /:id/share; DELETE /:id/share; POST /:id/share/regenerate; POST /:id/send; DELETE /:id/scheduled-delivery; POST /:id/duplicate; DELETE /:id | Invoice, StudioConfig | Verified via tests (bounded cases below) |
| leadroutes.js | /api/leads | GET /; POST /; POST /:id/project; POST /:id/tasks; PATCH /:id; POST /:id/remind/:photographerName; DELETE /:id | Lead, Notification, Photographer, Task, User | Source-only |
| media.js | /api/media | POST /upload; GET /files; GET /files/:clientId; DELETE /:id; POST /drive-collection; GET /folder/:folderId | Media | Source-only |
| notificationRoutes.js | /api/notifications | GET /; PATCH /:id/read; POST /mark-all-read; DELETE /clear-all; DELETE /:id; POST /create | Notification | Source-only |
| photographerRoutes.js | /api/photographers | GET /; POST /; DELETE /:id; PATCH /:id; GET /:name/works | Service-managed / no direct model import | Source-only |
| projectSupportRoutes.js | /api/project-support | GET /; GET /unread; GET /:id/messages; POST /:id/messages | ProjectMessage, Quotation | Verified via tests (bounded cases below) |
| publicInvoiceRoutes.js | /api/public-invoices | GET /:token | Invoice, StudioConfig | Verified via tests (bounded cases below) |
| publicProjectRoutes.js | /api/quotes (nested publicQuoteRoutes) | GET /:token/project; GET /:token/messages; POST /:token/messages | Service-managed / no direct model import | Verified via tests (bounded cases below) |
| publicQuoteRoutes.js | /api/quotes | GET /:token; POST /:token/accept | Invoice, Notification, Quotation, StudioConfig | Verified via tests (bounded cases below) |
| quoteWorkflowRoutes.js | /api/studio | GET /quotations/:id/client-link; GET /quotations/:id/preview; POST /quotations/:id/share; GET /quotations/:id/email-history; DELETE /quotations/:id/share; POST /quotations/:id/share/regenerate; POST /quotations/:id/email; POST /quotations/:id/schedule; DELETE /quotations/:id/schedule; POST /quotations/:id/duplicate; POST /quotations/:id/cancel; POST /quotations/:id/archive; PATCH /quotations/:id/number; PATCH /quotations/:id/project; PUT /quotations/:id/settings; POST /quote-templates; GET /quote-templates; PUT /quote-templates/:id; DELETE /quote-templates/:id | Lead, Quotation, QuoteDelivery, QuoteTemplate, StudioConfig, StudioContact, StudioProject | Verified via tests (bounded cases below) |
| receiptRoutes.js | /api/studio | GET /ledger/:id/receipt; POST /ledger/:id/receipt | Finance, FinanceReceipt | Source-only |
| studioCommunicationRoutes.js | /api/studio | GET /email/status; POST /email/test | StudioOperationLease, User | Source-only |
| studioDeviceRoutes.js | /api/studio/devices | GET /status; POST /; DELETE /:installationId | StudioPushDevice | Source-only |
| studioPreferencesRoutes.js | /api/studio | GET /preferences; PATCH /preferences | User | Source-only |
| studioProfileRoutes.js | /api/studio | GET /profile-images/:id; POST /profile-images | StudioProfileImage | Source-only |
| studioRoutes.js | /api/studio | PATCH /booking-payments/:id; GET /finance; POST /ledger; PUT /ledger/:id; DELETE /ledger/:id; GET /settings; PUT /settings; GET /clients; POST /clients; PATCH /clients/:id; GET /quotations; POST /quotations; PUT /quotations/:id; GET /assets; POST /assets; PUT /assets/:id; DELETE /assets/:id | AssetRecord, Finance, Invoice, Lead, Quotation, StudioConfig, StudioProject, User | Source-only |
| studioSecurityRoutes.js | /api/studio/security | GET /access; GET /sessions; POST /activity; DELETE /sessions/:id; POST /sessions/revoke-all; POST /logout; GET /backups; POST /backups; GET /backups/:id/download; POST /backups/:id/restore; GET /recovery; POST /recovery/:id/restore | AdminSession, RecoveryRecord, StudioBackup | Source-only |
| taskRoutes.js | /api/tasks | GET /; POST /apply-template; POST /; PATCH /:id; DELETE /:id | Lead, Task | Source-only |
| webhookRoutes.js | /api/webhooks | GET /enquiries/status; POST /enquiries | Lead | Source-only |
| whatsappRoutes.js | /api/integrations/whatsapp | GET /webhook; POST /webhook; GET /status; POST /verify; POST /wabb/messages; GET /conversations; POST /conversations; GET /conversations/:id; POST /conversations/:id/messages; GET /templates; PUT /conversations/:id/link; PUT /conversations/:id/consent; POST /conversations/:id/read | Service-managed / no direct model import | Source-only |
| workspaceSearchRoutes.js | /api/studio/search | GET / | Invoice, Lead, Quotation, StudioContact, StudioProject | Source-only |

Active auth is defined in `backend/server.js`: POST `/api/auth/register`, POST `/api/auth/login`, GET `/api/auth/me`, PUT `/api/auth/profile`, GET `/api/auth/google`, GET `/api/auth/google/begin`, GET `/api/auth/google/callback`, POST `/api/auth/google/webhook`. Data: User/AdminSession plus OAuth helpers. Personal registration creates a client record, not an administrator. The public UI has no client signup/login route.

Other boundaries:

| Boundary | Implementation / data | Evidence status |
| --- | --- | --- |
| GET `/api/health`, API readiness | `utils/runtimeReadiness.js`; MongoDB readiness/index initialization | Source-only in this audit |
| Frontend-host `/api/website/content`, `/reviews`, `/enquiries` | `frontend/server.js`, `website-server.mjs`; projected content manifest, Google Places server request, existing enquiry webhook | Source-only; live provider/CRM path external unverified |
| Conditional `/api/saas` | `saas/routes.js`, `socialRoutes.js`, `billing.js`, `service.js`; SaaSAccount, SaaSWorkspace, SaaSMembership, SaaSInvitation, SaaSBillingEvent, SaaSOAuthFlow | Source-only; only mounted when `SAAS_ENABLED=true`; commercial release not verified here |
| Realtime and workers | `realtime/studioSocket.js`, `saas/realtime.js`, `ReminderService`, quote/invoice delivery, automation/backup workers | Source-only for scheduling/deployment; selected quote delivery/idempotency behavior tested |
| Media storage | `/uploads` static route, upload routers/media services, StudioProfileImage/FinanceReceipt records | Source-only here; access, persistence and provider behavior require route-specific checks |

### Data ownership and relationships

- Lead stores enquiry/event/follow-up and booking metadata. StudioContact is the reusable contact; StudioProject is the canonical contact/project relationship. `services/enquiryPipeline.js` synchronizes them.
- Quotation carries contact/project/lead references, revision, financial snapshot, lifecycle/timeline, visibility settings and hashed share capability. QuoteTemplate retains reusable settings without client/project identity.
- Accepted quotation reserves one invoice identifier. Invoice stores immutable sourceQuotation/sourceRevision, issuer snapshot, line items, discount/tax, payment plan and recorded receipt state. The sourceQuotation unique index and upsert protect duplicate invoice creation.
- Task links to the lead, has assignment/production stage/delivery metadata and an explicit clientVisible flag. Only client-visible, canonical-project task data is projected to Smart Link.
- ProjectMessage belongs to a quotation; client/studio author is server controlled. QuoteDelivery tracks delivery jobs and retry state.
- Event and Photographer support calendar/crew. Finance and FinanceReceipt store ledger entries/private receipt media; AssetRecord stores storage metadata.
- StudioConfig holds shared studio defaults; User/AdminSettings/AdminSession hold personal access/preferences/security; DocumentCounter and StudioOperationLease support numbering/concurrent operations; Notification stores shared activity.
- StudioBackup and RecoveryRecord are database-record recovery features, not a physical RAW-media backup system.
- GmailConnection/GmailOAuthNonce, WhatsAppConnection/Conversation/Message/Receipt, WabbMessageAttempt, DriveGallery/GalleryEvent, Gallery/Media, Message/ChatRoom, SheetConfig and StudioPushDevice support separate integrations/legacy/native functions. Presence of these collections does not verify external provider connectivity.
- Personal versus commercial isolation is explicit: `saas/access.js`, `tenantContext.js` and `tenantModels.js` select studio databases only from verified workspace sessions. Commercial integration inheritance is blocked in middleware. Multi-studio deployed verification remains external unverified.

## Focused workflow and security results

**Verified via tests, 63 backend tests:**

`quote-lifecycle.test.js`, `quote-client-link.test.js`, `quote-workflow.test.js`, `invoice-workflow.test.js`, `client-project.test.js`, `client-link-privacy.test.js`.

| Behavior | Result and boundary |
| --- | --- |
| Quote sharing | Concurrent shares converge on one stable capability; malformed origin cannot mark a quote shared; authenticated client-link retrieval preserves accepted/sent state without writes |
| Acceptance | Consent/name/revision/expiry checked; atomic claim reserves one invoice ID; retries repair interrupted invoice insert without a second invoice |
| Quote expiry/status | Indian selected-day boundary, disabled expiry and immutable accepted lifecycle handled by focused tests |
| Amounts | Integer-paise discount/tax rounding, supported limits and conversion preserve quote totals |
| Invoice plan | Ordered dates, positive installments and final rounding remainder; server rejects invalid schedules |
| Issuer identity | Per-document snapshots persist through partial edits; safe branding fields exclude injected/private fields |
| Invoice authority | Saved administrator sessions and issue permissions gate protected routes; preview does not accept; current-state checks protect cancellation/concurrent issue |
| Public links | Hashed lookup, lifecycle/status, expiry/revocation and visibility rules gate document access; malformed tokens/IDs fail before record projection |
| Client project | Draft invoice exposes no schedule/private amounts; only issued non-cancelled invoice releases approved data; matching lead/project and clientVisible tasks required |
| Privacy | Public responses omit private email, operational references, tokens and delivery records; crew projection limits fields; unsafe/unpublished delivery URLs stay private |
| Support | Project-scoped/bounded history; server-controlled author; idempotent request IDs; input/rate limits; unread markers do not consume unseen messages |
| Email jobs | No sent record when mail configuration missing; stale revisions cancel before SMTP; retries honor delivery request state; uncertain SMTP outcome is not silently retried |

**Verified via tests, 39 frontend helper tests:**

`client-payment.test.mjs`, `client-dashboard.test.mjs`, `client-project.test.mjs`, `contact-payments.test.mjs`, `quotation-status.test.mjs`, `document-client-link.test.mjs`, `invoice-navigation.test.mjs`.

- Quotation paise values/status, unknown/malformed fields, accepted/expiry state.
- Issued invoice balance; earliest installment credit allocation; no duplicate deposit counting; fully paid/cancelled/draft and malformed schedule behavior.
- UPI URL encodes only supported saved fields, valid VPA, explicit INR, positive integer-paise amount within outstanding balance; no client capability/callback data in handoff.
- Merely opening UPI/bank instructions does not confirm payment or mutate invoice.
- Hidden production/financial settings do not derive guessed amounts/progress.
- Canonical document URL and record identity take priority over ambiguous client-name matching.

**Verified via tests, 45 shared control/session/navigation tests:**

`studio-button.test.mjs`, `studio-select.test.mjs`, `studio-dialog-isolation.test.mjs`, `mobile-viewport.test.mjs`, `iphone-app-navigation.test.mjs`, `studio-browser-theme.test.mjs`, `auth-session.test.mjs`, `studioNavigation.test.mjs`.

- Button duplicate/reentrant/pending activation guard, retry after failure, no false success.
- Select options preserve labels/values/group-disabled state.
- Nested dialog isolation/scroll-lock cleanup and reopened drawer touch ownership.
- Keyboard viewport/rotation/focusout handling, listener/timer cleanup, hardware keyboard and pinch-zoom distinction.
- Phone/More versus iPad/desktop navigation choice and DEV preview gating.
- Session state/race/timeout handling, public client-link availability after admin expiry, safe internal return paths.
- Browser theme helper and white sign-in safe-area selection. These are helper tests, not proof of Safari chrome rendering on every iOS version.

The focused subset above contains **147 passed, 0 failed**. It is included in, and must not be added again to, the final **635-test** result below. No live provider or financial side effects.

Changed `ContactDetail.jsx` and `Quotations.jsx` passed ESLint. The additional recovery boundary has six state/privacy/reset tests; final build/browser results are recorded below without extrapolating to untested controls.

## Confirmed contact/document UI repairs in this checkout

- Contact header groups the name, contact type and actions instead of competing flex siblings; phone contact type uses the shared choice sheet.
- Contact related-project/session rows have themed borders, padding and bounded metadata/status content.
- Phone contact sections, four tabs, contact-info editing and label/value rows use explicit geometry.
- Accepted quote with invoice uses a balanced 2×2 action grid, keeping invoice and Smart Link together. Phone rules are scoped to screen media; authored document/print behavior is preserved.
- These are local source changes until the release owner completes review/publication. Do not infer production deployment from this document.

## Integration dependencies and missing capabilities

| Capability | Current boundary | Required verification / dependency |
| --- | --- | --- |
| Outgoing quotation/invoice/reminder email | SMTP mailer and retry/history machinery implemented | External unverified: private `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` (or `EMAIL_USER`/`EMAIL_PASS`), sender/provider permissions, real inbox receipt and scheduled worker operation |
| Gmail browsing | Separate OAuth read-only mailbox API/UI; it is not the SMTP sender | External unverified: Gmail API, approved read-only scope, callback/client credentials, encrypted saved connection, real account/reconnect. Send/archive/delete absent from this flow |
| Google Calendar | OAuth connect/status/import/sync/disconnect implementation | External unverified: enabled API, registered `GOOGLE_REDIRECT_URI`, private client credentials, user consent/refresh tokens, deployed webhook/polling and event round-trip |
| WhatsApp/Wabb | Manual share links remain operational intent; optional provider APIs exist | External unverified: plan/provider docs, saved credentials, exact number/account verification, coexistence/consent and supported callbacks. No new provider integration activated during audit |
| Website enquiries | Frontend server calls authenticated existing CRM webhook | External unverified: canonical endpoint, server-only matching secret, live form receipt in CRM and retry behavior |
| Google reviews | Server-side Places request and tasteful unconfigured fallback | External unverified: authorized Places credentials/business place, attribution and actual reviews. No invented reviews |
| Client payment | Saved bank details / explicit UPI handoff | Gateway charge creation, automated payment verification and settlement reconciliation are **missing from this flow**. Studio-confirmed receipts remain authority; no handoff is labelled verified payment |
| Mobile native lock/push | Native bridge and device registration source exists | External unverified: signing/entitlements/APNs configuration, device authorization, lifecycle and physical iPhone tests |
| Calendar week/day timeline and drag scheduling | The routed Calendar implements Month and Agenda, including a selected-day agenda | Week/day time-grid views, drag-and-drop movement and drag-resize are **missing from this routed calendar flow**; FullCalendar package presence does not establish those features |
| Password reset / account MFA | Inspected personal auth routes support login/session/profile and Google Calendar authorization | Self-service forgot/reset-password, TOTP/passkey/account-MFA setup are **missing from the inspected personal-auth routes/UI**. Native app lock is a separate device feature |
| Physical-media backup | Metadata catalogue and record snapshots/recovery exist | Automated independent RAW-media/offsite copy and restore are **not provided by the inspected catalogue** |
| Public website CMS | Projected manifest can use configured file/URL and existing defaults/media | Complete in-console content publishing/ordering workflow was not established by this audit; source-only. Do not describe every public section as CMS editable without further mapping |
| Commercial SaaS | Conditional source/build/API gates; workspace, membership, billing models | External unverified: separate staging/domain/database, tenancy/role/seat/subscription end-to-end verification, approved prices and Razorpay account/webhooks. Not included in personal repairs |

Only environment variable names are documented; secrets and account credentials are excluded.

## Accessibility and performance review

Source mechanisms already available:

- Route-based lazy imports/Suspense keep public pages and large admin modules separate (`App.jsx`).
- Shared `StudioButton` maintains labels/content geometry while loading and prevents duplicate async activation; `StudioIcon` supports decorative/labelled SVG semantics and real activity states.
- Shared `StudioSelect`, `WorkspaceActionMenu` and `useStudioDialog` centralize mobile choices, keyboard navigation, focus handling, backdrop isolation and scroll cleanup.
- `useWorkspaceData` rejects stale responses by sequence number; selected notification/sidebar requests use AbortController and visibility-aware polling with cleanup.
- Public story/portfolio images use responsive srcsets/sizes, lazy/async loading below the fold and high-priority story hero where configured.
- CSS contains reduced-motion variants; scoped phone fixes avoid changing print media.

Opportunities requiring measured follow-up (source-only, not claims of current production failure):

1. Consolidate repeated high-specificity rules across `studio-brand.css`, `studio-mobile.css`, `studio-phone.css`, `studio-phone-refinement.css`, `studio-compact-phone.css` and page CSS into shared tokens/components after screenshot regression coverage. Broad removal during a critical repair risks existing device states.
2. Continue migration of legacy raw buttons/selects to shared components in bounded screen batches; retain native form behavior and audit accessible names/submit types as each control is migrated.
3. Add browser regression coverage for contact/enquiry detail, quote detail/editor, invoice installments, settings upload and nested phone choices at phone/tablet/desktop widths in both themes.
4. Add request cancellation/deduplication to shared workspace data loading where measurement shows duplicate fetches; sequence guards prevent stale renders but do not cancel network work.
5. Measure actual bundle sizes, idle/active render work, long-task/animation behavior and image transfer sizes on a throttled physical phone before performance claims.
6. Run a defined Lighthouse/accessibility audit and screen-reader/keyboard journey. No Lighthouse score, WCAG conformance, Core Web Vitals target or flawless-device claim was measured by this inventory.

## Prioritized fixed defect register

These entries describe the local repair set. “Fixed” is bounded by the named source, automated and local-browser evidence; external behavior stays explicitly unverified.

| Priority | Defect before repair | Result after repair / evidence boundary | Main implementation |
| --- | --- | --- | --- |
| P1 | A manually entered enquiry had no dependable project/quotation continuation | Explicit create/open-project and prepare-quote entry points preserve the enquiry; stable contact/project identifiers, snapshot transactions and conflict guards avoid partial or duplicate relationships. Local fresh-enquiry → project → blank quotation → save ₹1,50,000 → refresh original passed | `services/enquiryProject.js`, `leadroutes.js`, `enquiryWorkflow.js`, CRM/lead-detail components |
| P1 | Linkage inference could accept inconsistent selected event context | Event creation/partial edits resolve the enquiry/contact/project together, reject mismatched explicit links, and preserve date/range validation | `utils/studioCalendar.js`, `calendarRoutes.js`, `calendar-date-range.test.js` |
| P1 | A profile photo could upload successfully but display as broken because the shared preferences router required a JWT for its image GET | Authentication is scoped to preferences; validated public brand-image GET and authenticated/admin image POST retain separate responsibilities. Personal and workspace-prefixed URLs are accepted consistently; a failed image is not silently saved as a successful replacement | `studioPreferencesRoutes.js`, `studioProfileRoutes.js`, image/branding helpers |
| P1 | Settings could save while a replacement photo was unresolved, or race against save/revert | A single operation gate coordinates upload/save/revert; cancellation and timeouts release the correct operation; visible fallback and decode confirmation distinguish a readable image from failed loading | `Settings.jsx`, `SettingsEditor.jsx`, `settingsActionGate.js`, `studioProfileImage.js` |
| P1 | Sign-in could remain pending without a bounded response/decoding timeout | One bounded, abortable request validates admin identity and token, reports timeout, and does not automatically retry credentials | `AuthPage.jsx`, `studioLogin.js`, `studio-login.test.mjs` |
| P1 | Outdated upload/email packages and an incompatible Cloudinary storage peer adapter complicated safe installs | Production dependency audits now report zero advisories. Multer 2.5.0, Nodemailer 10.3.1 and sharp 0.35.5 use locked dependencies; a local Cloudinary StorageEngine handles stream errors, cancellation and cleanup without the removed legacy adapter | Both manifests/locks, `storage/cloudinaryStorage.js`, gallery routes, adapter tests |
| P1 | Enquiry update failures logged request-body details; a legacy crew-reminder endpoint returned a success-like mock response; a stalled new-enquiry save could hang | PATCH failures now log only a static code and return bounded generic 400/409/503 messages; the unused reminder endpoint returns explicit 503 “No reminder sent”; new-enquiry requests time out after 30 seconds, retain the draft/checklist and avoid automatic retry | `leadroutes.js`, `enquiry-route-errors.test.js`, `StudioLeadForm.jsx` |
| P2 | Date/time controls could exceed narrow parents; enquiry headers/actions, contact related rows and document actions competed for width | Scoped field minimum widths, responsive groups, padded related-record rows and a balanced accepted-quote action grid prevent the reported overflow in checked Chromium sizes | Lead/contact CSS/components, `studio-live-mobile.css`, document page CSS |
| P2 | Settings icons looked faded in dark mode, and reminder/time/photo sections lacked consistent alignment | Explicit icon contrast, responsive settings rows and shared choice sheets apply consistent phone geometry in both themes; all fourteen sections were opened at 390px dark | Settings CSS/editor, `studioSelect.css` |
| P2 | Invoice installment presets/status/design choices used inconsistent native-only controls and an empty enabled schedule could not recover cleanly | Shared native/phone-sheet selectors retain labels and change events; schedule-toggle helper prepares a valid schedule or shows required inputs rather than an unusable add-payment action | `InvoiceWorkspace.jsx`, invoice CSS, `settingsDefaults.js` |
| P2 | A rendering exception could leave the application blank | An App-level route-aware React boundary inside AuthProvider offers focused, accessible retry/home/reload recovery, preserves captured theme, and resets a failed subtree on pathname/query change without remounting healthy routes | `main.jsx`, recovery components/CSS and six focused tests |
| P2 | Safari sign-in inherited a warm page/browser canvas that appeared as yellow top/bottom bands | Auth-specific white browser theme, root/background and safe-area rules now align sign-in with its white surface. Chromium/helper checks passed; actual Safari chrome remains a physical-device check | `AuthPage.jsx`, `auth.css`, `studioBrowserTheme.js` |

The backend suite was rerun after the two new enquiry-route security cases: **403 passed**. The final production build passed after the enquiry-form timeout change (source commit 6). Final report-commit CI remains a review gate.

## Final validation matrix

Results below combine the recorded automated runs with release-owner local browser checks. A local fixture/API journey is not a production write or a deployed MongoDB/provider round-trip.

| Check | Result | Conditions / limitation |
| --- | --- | --- |
| Frontend automated suite | **232 passed** | Current local repair snapshot; includes shared controls, navigation, settings, document/payment helpers and recovery tests |
| Backend automated suite | **403 passed** | Current local repair snapshot; focused service/router tests use fixtures/mocks unless a test states otherwise |
| Combined automated tests | **635 passed** | 232 + 403; do not add the earlier focused subsets again |
| Studio/public/mobile lint | **Passed** | Includes explicit lint of new recovery helpers; workflow removes legacy peer-dependency install option |
| Production build | **Passed** | Final Vite production build after commit 6, including the last enquiry-form timeout edit; no production deployment |
| Dependency production audits | **0 advisories** in frontend and backend production trees | Audit snapshot after locked upgrades; not a guarantee of future vulnerability absence |
| Dependency development-inclusive audits | Frontend **6 moderate**, backend **2 moderate** | Remaining dev advisories disclosed; no claim of a completely clean development tree |
| Fresh enquiry → project → quotation | **Passed locally** | Correct canonical contact/project selections; quote saved as ₹1,50,000; refresh retained the original enquiry and notes/venue/value |
| Quote acceptance → draft invoice → studio issue → same Smart Link | **Passed locally** | Draft/issued visibility gates and same-link progression; real payment/email not performed |
| Bank / UPI payment instructions | **Passed locally** | Opens instructions/validated handoff; no charge or verified bank receipt asserted |
| Client support | **Passed locally**, client → studio | Local project-scoped message reached the studio inbox; client receipt of a studio reply was not rechecked after the disposable API restart. No real customer contacted |
| Representative route smoke | **21 pages**, no document overflow in tested matrices | Chromium: 390px light and dark; 960px light; 1600px light; 1920px dark |
| Settings | **All 14 sections opened** at 390px dark | Times/reminder controls inspected; not certification of every save/provider/native action |
| Route error recovery | Automated state/privacy/reset checks passed; fallback exercised locally | Retry and route recovery are bounded to React render errors, not arbitrary network/async failures |
| Date persistence | Backend date/linkage preservation tests passed | Browser automation `.fill()` changed DOM values without delivering React change events. Do not infer physical/native date-field persistence from this tool; Safari testing pending |
| Screenshots | Images **inspected inline** | Screenshot file export returned **EPERM**. No downloadable before/after files were produced; attachments must not be fabricated |
| Production data / deployment | **No writes or deployment** | Local disposable checks only; final release requires explicit approval |

### Bundle measurements

Comparison against `../teamalpha-ui-refinement`, measured from the final successful commit-6 build artifacts. Gzip totals sum each artifact independently; they are not the transfer size of a single user journey.

| Artifact metric | Baseline bytes | Repair bytes | Change |
| --- | ---: | ---: | ---: |
| JavaScript artifact count | 80 | 81 | +1 |
| All JavaScript, raw sum | 2,492,217 | 2,510,024 | +17,807 |
| All JavaScript, gzip sum | 790,130 | 796,706 | +6,576 |
| Entry JavaScript, raw | 281,198 | 284,335 | +3,137 |
| Entry JavaScript, gzip | 91,325 | 92,373 | +1,048 |
| All CSS, raw sum | 898,397 | 916,957 | +18,560 |
| All CSS, gzip sum | 160,025 | 162,755 | +2,730 |

This repair increases the measured bundle sizes. No performance improvement, Lighthouse score, Core Web Vitals result or physical-device smoothness claim follows from these build figures.

## Development branch, commits and reproducible checks

Branch: `fix/studio-os-audit-enquiry-mobile`, based on `release/team-alpha-production` at `a3a89293413655367085163d1fa83dc940f86282`. No changes were pushed to main or the production branch. The sparse local repair copy has no Git metadata; reviewed files were committed through GitHub's Git-data API. All 59 runtime/test/package files through commit 6 were compared by Git blob hash with the final local files; they matched. This report and the CI workflow make up the remaining two review files.

| Commit | Purpose |
| --- | --- |
| `42e2c7c178db2f038c29cd899ce35782141c6c3a` | Enquiry transaction/linkage and calendar context |
| `6b86ea0f4bca791e04241a5046a0715fed3fd9b2` | Public profile images, settings coordination and bounded sign-in |
| `930199ee96812a02bd57f36fbaa99e594462f7a4` | Scoped mobile enquiry/contact/document/settings layouts |
| `2e6770b01a52ba2a967b2822264cb48623db6691` | Route-aware render recovery with authentication preserved |
| `23dbcabfabac5718ae3d28f349045f5d28af590a` | Dependency and Cloudinary StorageEngine hardening |
| `906288abd69ab20466b73cf048c5d350c061e9fb` | Private diagnostic protection, truthful legacy reminder error and enquiry save timeout |
| Final report/CI commit | This inventory, evidence and broader CI lint; see PR #16 for its resulting SHA/checks |

Reproduce with a supported Node version and clean dependencies:

```sh
# frontend directory
npm ci
npm test
npm run lint:studio
npx --no-install eslint src/main.jsx src/components/AppErrorBoundary.jsx src/components/RouteErrorBoundary.js src/utils/studioLogin.js src/utils/studioProfileImage.js src/utils/settingsActionGate.js src/utils/enquiryWorkflow.js
npm run build
npm audit --omit=dev

# backend directory
npm ci
npm test
node --check server.js
npm audit --omit=dev
```

The local sandbox invoked the same test files/ESLint targets directly through Node 24.19.0; its bundled npm shell launcher could not resolve its own Node installation. The normal GitHub Actions workflow supplies Node 24 and runs the npm commands. No forced dependency resolution is required. Native sharp decode/encode, bcrypt compare and local MIME composition were smoke-tested without provider credentials or email delivery.

## Release checklist and current status

**Ready for additional staging validation**, with these gates:

- [x] Source/module/settings/API inventory completed with evidence boundaries.
- [x] Prioritized local repairs implemented; focused independent code review found no release-blocking regression in the inspected transaction/auth/dropdown changes.
- [x] Recorded 635-test snapshot, lint and final commit-6 production build passed.
- [x] Chromium responsive smoke and local enquiry/document/payment/support journeys completed.
- [x] Draft PR #16 opened; first five commits passed CI. Dependency commit recorded above.
- [ ] Include the final report commit and confirm its CI result. Final local build after security/reminder/request-timeout commit `906288abd69ab20466b73cf048c5d350c061e9fb` passed.
- [ ] Staging real MongoDB transaction/concurrency/retry and durable linkage verification, including interrupted/repeated requests.
- [ ] Physical iPhone Safari daylight/dark, date/time picking, keyboard, safe-area, choice-sheet and long-page checks; iPad/native lifecycle checks where applicable.
- [ ] Controlled profile image upload → decode → save → refresh/retrieve against staging storage/provider; cancellation, unmount and failure cases.
- [ ] Configure and verify authorized SMTP/Gmail/Calendar provider accounts/callbacks privately; actual delivery/import/reconnect remains unverified.
- [ ] Verify manual WhatsApp sharing as the agreed mode; do not activate new provider integration by implication.
- [ ] Confirm the frontend build host and backend run a supported Node version before applying these locks. Confirm the database is a replica set/Atlas deployment supporting snapshot transactions; a standalone database intentionally fails closed for new enquiry project preparation.
- [ ] Before an approved release, take a restorable managed database snapshot/export and verify its restore in an isolated database; retain the currently deployed frontend/backend commit and private environment configuration. Do not use the Studio OS metadata catalogue as proof of RAW-media backup.
- [ ] No model/schema migration or destructive backfill is included. Test existing incomplete/duplicate associations on a redacted staging copy; conflicts must be reviewed instead of force-linked. Confirm old documents/images and existing sessions remain usable.
- [ ] Rollback plan: redeploy the previously retained frontend/backend commit together if smoke checks fail. Preserve all records created during the release; do not erase links, quotes, invoices or payments to reverse the code update. Any database recovery needs a separate, reviewed data-reconciliation plan.
- [ ] Monitor sanitized error codes/5xx, transaction conflicts/latency, image retrieval/decode errors, failed/uncertain delivery jobs and health readiness after a future release. Validate enquiry → project → quote and client-link draft/issued visibility with dedicated test records; never log request bodies, secrets or private client content.
- [ ] Obtain explicit production publication approval; no main merge/live data mutation/deployment is recorded here.

## Complete changed-file inventory

Content comparison against `../teamalpha-ui-refinement`: **M** = modified present file, **A** = added present file. This is the repair payload inventory, not Git status. Baseline-only files deliberately omitted from the sparse repair copy (README, environment examples, prior documents and native preview servers) are **not intended deletions**. Dependencies, build output, temporary review harnesses, QA caches and logs are excluded.

| Change | File |
| --- | --- |
| M | `.github/workflows/studio-checks.yml` |
| M | `backend/package-lock.json` |
| M | `backend/package.json` |
| M | `backend/routes/calendarRoutes.js` |
| M | `backend/routes/driveGalleryRoutes.js` |
| M | `backend/routes/galleryRoutes.js` |
| M | `backend/routes/leadroutes.js` |
| M | `backend/routes/studioPreferencesRoutes.js` |
| M | `backend/routes/studioProfileRoutes.js` |
| A | `backend/services/enquiryProject.js` |
| A | `backend/storage/cloudinaryStorage.js` |
| M | `backend/test_cloudinary.js` |
| M | `backend/tests/calendar-date-range.test.js` |
| A | `backend/tests/cloudinary-storage.test.js` |
| M | `backend/tests/document-defaults.test.js` |
| A | `backend/tests/enquiry-project.test.js` |
| A | `backend/tests/enquiry-route-errors.test.js` |
| M | `backend/tests/studio-communication-profile.test.js` |
| M | `backend/tests/studio-settings.test.js` |
| M | `backend/utils/invoiceBranding.js` |
| M | `backend/utils/studioCalendar.js` |
| M | `backend/utils/studioSettings.js` |
| A | `docs/studio-os-audit.md` |
| M | `frontend/package-lock.json` |
| M | `frontend/package.json` |
| M | `frontend/src/admin/components/calendar/EventForm.jsx` |
| M | `frontend/src/admin/components/common/studioSelect.css` |
| M | `frontend/src/admin/components/settings/SecurityRecoveryPanel.jsx` |
| M | `frontend/src/admin/components/settings/SettingsEditor.jsx` |
| M | `frontend/src/admin/components/studio/StudioLeadDetails.jsx` |
| M | `frontend/src/admin/components/studio/StudioLeadForm.jsx` |
| M | `frontend/src/admin/pages/CRM.jsx` |
| M | `frontend/src/admin/pages/ContactDetail.jsx` |
| M | `frontend/src/admin/pages/InvoiceWorkspace.jsx` |
| M | `frontend/src/admin/pages/Quotations.jsx` |
| M | `frontend/src/admin/pages/Settings.jsx` |
| M | `frontend/src/admin/pages/invoiceWorkspace.css` |
| M | `frontend/src/admin/pages/quotationWorkspace.css` |
| M | `frontend/src/admin/pages/referenceContacts.css` |
| M | `frontend/src/admin/pages/settingsGrouped.css` |
| M | `frontend/src/admin/pages/studioSettings.css` |
| M | `frontend/src/admin/studio-live-mobile.css` |
| A | `frontend/src/components/AppErrorBoundary.jsx` |
| M | `frontend/src/components/AuthPage.jsx` |
| A | `frontend/src/components/RouteErrorBoundary.js` |
| A | `frontend/src/components/appErrorBoundary.css` |
| M | `frontend/src/components/auth.css` |
| M | `frontend/src/main.jsx` |
| A | `frontend/src/utils/enquiryWorkflow.js` |
| A | `frontend/src/utils/settingsActionGate.js` |
| M | `frontend/src/utils/settingsDefaults.js` |
| M | `frontend/src/utils/studioBrowserTheme.js` |
| M | `frontend/src/utils/studioIdentity.js` |
| A | `frontend/src/utils/studioLogin.js` |
| A | `frontend/src/utils/studioProfileImage.js` |
| A | `frontend/test/app-error-boundary.test.mjs` |
| A | `frontend/test/enquiry-workflow.test.mjs` |
| A | `frontend/test/settings-action-gate.test.mjs` |
| M | `frontend/test/studio-browser-theme.test.mjs` |
| A | `frontend/test/studio-login.test.mjs` |
| A | `frontend/test/studio-profile-image.test.mjs` |

Inventory contains **61 files** at report generation. Final review commit collection is owned by the release owner.
