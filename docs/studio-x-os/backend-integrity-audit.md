# Studio X OS backend integrity audit

**Review branch** `audit/backend-integrity-20261128` · **Release baseline** `00f89762ecf8b0dea2d8447ad664b3ca7481fe65`

## Verdict

A disposable two-studio journey verified that a booking, its contact, a restored production task, an accepted quote, and a partially paid invoice survived both HTTP process and database restarts. The other studio’s invoice register stayed empty. The release baseline passed its existing suite but failed new cases involving partial writes, inaccurate money totals, scheduling conflicts and repeated requests. The corrections and their regression cases are on this branch. No live database, client, payment account or messaging service participated.

The [route and schema inventory](backend-integrity-inventory.md) lists 279 HTTP declarations and 53 Mongoose models, including optional personal-installation features. The evidence below distinguishes real database journeys, application or service tests against fixtures, and reviewed-only behavior. An inventory entry alone does not establish that a route passed an end-to-end test.

## Runtime and workflow map

Express mounts the API in `backend/server.js`. Readiness, workspace selection, public link scope, archive maintenance and role checks run before protected operations. MongoDB holds business data, job state, receipts, archives and session metadata. The SaaS control database owns accounts, workspaces, memberships, invitations, billing events and OAuth bindings. Tenant-aware models resolve the current workspace’s separate database before each operation, including populated relations. The connections and model methods are reused. Most dashboard and registry aggregates read from MongoDB on request. Social signing keys, push credentials and some rate/lease state have process-local caches. Cross-instance rate limiting and provider key rotation under load were outside the measured scenarios.

| Area and actors | Required association or rule | Records, results and evidence |
|---|---|---|
| Sign-in, setup, switching | Active account, active workspace and membership. The owner completes onboarding. SaaS roles are owner, admin and staff. Module restrictions also apply. A crew profile is a business record. | Two owners onboarded separate studios and one invited an editor in real HTTP flows. A persisted session remained usable after the restart. Existing tests cover OAuth callbacks, setup restart, module restrictions, revoked/expired sessions and owner-only operations. Commercial identity provider consent used fixtures. |
| Enquiry, contact and booking | A conversion is linked by enquiry, contact and project IDs. Additional clients and crew must belong to the studio. Display names can repeat. | Same-enquiry conversions raced in MongoDB and produced one linked project. Creating or booking a project with default production stages uses a transaction. |
| Quoting and client approval | Server computes the quote from line inputs. Client assent requires an eligible link and quote revision. Document numbers, invoice IDs and acceptance side effects survive retries. | Concurrent approval, replay, expiry, cancellation and settings changes exercised in route suites. The persisted approval created one invoice draft and one activity record. |
| Invoicing, collection and reporting | An authorized user issues the invoice. Staff can read within their permitted scope. Recording payment updates a cumulative received amount under an edit revision. | HTTP approval, partial receipt, stale payment edit, reload, full payment, and register checked with real storage. The linked invoice showed the same number and amounts after restart. Recording an advance here is a bookkeeping action. A provider settlement requires separate evidence. |
| Crew, calendar and scheduling | Local events use studio-local rules and half-open time intervals. Crew names still appear in historical events. | Parallel bookings, adjoining time slots, edits, and two-studio isolation tested. Google imports, invalid pages, expired connections and provider errors tested with fixtures. Imported Google events can reflect externally created conflicts. |
| Tasks, stages and delivery | Tasks link back to the enquiry. Completion status drives production progress. The client link exposes eligible deliverables and staff-approved URLs. | Real creation, deletion and Recovery restore preserved the same task ID and reverse reference. Production stages tested under a deliberate failure and retry. Smart Link projections, gated payments, link expiry/revocation and private support fields tested with fixtures. |
| Expenses, files and costs | Expense receipts belong to a specific finance row. The proof bytes and metadata must commit together. | Failed replacement, retry, authenticated download and fresh database reads tested on the replica set. Finance routes tested with income and expense examples. Crew compensation and vendor dues have no independently reconciled payroll settlement in these checks. |
| Settings and document defaults | Personal preferences apply to the signed-in user. Document issuer, payment schedule and issued amounts can be snapshotted. Studio defaults apply prospectively. | Existing tests verify personal preference GET/PATCH, empty dashboards, order and partial preference updates, numbering reservations, old issued documents and quote-to-invoice conversion. Browser-only discard and local view reset are outside a backend test. |
| Subscriptions, access and invitations | Owner checkout, approved provider plan and verified subscription determine entitlement. Active memberships and pending invitations consume seats. | A local signed provider fixture checked early, duplicate, delayed and stale events. A final-seat race, expiry and invitation removal exercised transactions. The default seat reconciliation command only reads the selected workspace. |
| Background communication and search | Workspace context and projection rules apply to jobs and reads. Scheduled mail has its own delivery state. Push routing uses the scoped device and notification. | Suites cover Socket.IO scoping, APNs composition, Gmail/Drive OAuth, WhatsApp ingestion/status, WABB, assistants, search, overview, date boundaries and worker failures. Search tests cover allowed modules, bounded literal matching and result caps. Provider production credentials, rate quotas and external delivery were not exercised. |
| Personal gallery, uploads and archive | Deployment flags separate personal and commercial routes. Private finance proofs, inline uploads and cloud galleries have different storage and access paths. | The commercial service gates legacy gallery/media/Drive Gallery routes. Smart Link’s deliverable status and client-approved links are available separately. The archive harness tests encrypted bytes and protected routes. Live Google Drive, Cloudinary, Sheets, legacy chat attachments and real mobile push were not round-tripped. |

## Significant findings

Severity describes the potential effect of the original behavior. Each row includes the check used to justify the fix.

| Severity | Workflow | Root cause | Correction | Verification | Remaining risk |
|---|---|---|---|---|---|
| High | Booking and default production | The project, enquiry and default tasks could succeed independently. An intervening failure left a booked record with missing work. | Include linked writes and template stages in the same transaction. | Fail the second stage during create, book and convert. Retrying the synthetic operation produced precisely the configured stages. | Requires transaction-capable storage. |
| High | Manual create after a lost response | Identical retries could insert a second contact, enquiry, project or task. | First-party forms keep one submission key per operation. The backend binds the receipt to the studio, actor, action and request content in the creation transaction. | The baseline created two contacts from simultaneous submissions. The branch returned 201 and 200 for the same ID and stored one contact. Reusing a key for different content returned 409. Distinct keys allowed intentionally identical names. | Older callers that omit the key retain their previous create semantics. |
| High | Task deletion and Recovery | The task and the enquiry’s task-ID list changed in separate writes. | Update both sides, including Recovery restoration, in one transaction. | Fault injection, fresh reads, same-ID restore, and server/database restart. | Historic mismatches require review of the original relation. |
| High | Quote acceptance and confirmation | An acceptance could mark activity complete before persisting it. A replay could overwrite a confirmation worker’s terminal state. | Persist keyed activity before completion, retain worker state across retries. | Concurrent and repeat acceptance produced one activity and one invoice. Worker state regression tests passed. | Actual SMTP acceptance cannot be inferred after an ambiguous network timeout. |
| High | Invoice collection and reporting | Partial advances were omitted from collected totals and presented as still due. Several percentage calculations multiplied binary fractions at a rounding boundary. | Sum money in paise, use integer percentage arithmetic, preserve previously approved quote totals, calculate balances consistently. | Independent money cases below, real HTTP finance reports and persisted invoice register. | The legacy booking/invoice rollup has no shared receipt identifier. |
| High | Invoice removal | Separate deletion entry points applied different checks to historical invoices. | Both routes use the same conditional deletion inside Recovery. | Across both routes, issued, paid, shared, quote-linked, partially paid, cancelled and previously approved invoices returned 409. An eligible draft produced exactly one Recovery entry. | Deleting an older ambiguous document requires examining its history. |
| High | Expense proof | Binary data and parent attachment metadata could diverge on failure. | Commit both together, including replacement. | Injected write failure returned 503. The previous bytes and timestamp survived. Retry succeeded. | MongoDB transactions are required on this write path. |
| High | Personal full reset and restore | A previous submission could still be valid after a reset and remove subsequently created work. | Submit the reviewed workspace generation and compare again under the maintenance lock. | Reset, create expense, replay → 409. Replace, create another expense, replay → 409. Owner and encrypted safety backup survived. | Old personal clients must refresh before submitting another destructive operation. |
| High | Studio seats and subscription status | Membership and seat reservation writes could drift. A prematurely delivered webhook could consume its deduplication key before checkout stored the subscription. | Transactional seat reservations, current provider state reconciliation, and retryable early delivery. | One seat allowed one racing invitation. Injected failure rolled back. Signed early event was retried after linking. Duplicate replay made no extra provider read. | Provider checkout creation can time out with an unknown result. |
| High | Crew double-booking | Simultaneous checks on independent event documents could both see availability. | Serialize overlapping local assignments inside a workspace transaction and reject stale edits. | Six same-time attempts produced one booking and five conflicts. Adjacent bookings and the second studio succeeded. | Standalone MongoDB rejects staffed bookings with 503. Other scheduling tools can still create conflicting Google events. |
| Medium | Calendar integration and notifications | Provider failure skipped local assignment feedback. Incomplete Google responses could look like a complete list. | Preserve committed local changes, emit scoped notices for newly assigned crew, validate complete pages and Google’s overlap window before cleanup. | Controlled provider errors, malformed responses, repeated pagination token and boundary fixtures. | No live Google reconciliation or quota test. |
| Medium | Scheduled activity | A fixed-size scan repeatedly selected the first due records. A global in-process guard could suppress another studio. | Page by stable keys, isolate runs by studio, and continue past isolated failures. | 205 due tasks and an injected failure. Concurrent studio workers processed both tenants. | Wall-clock deployment downtime and production backlog sizes were not measured. |
| Medium | Contact drafts and activity inbox | A one-field PATCH required the whole draft, an omitted project link could be cleared, and marking a notification read returned the shared read flag. | Only update supplied editable draft fields, validate their relation, and return per-member notification state consistently. | Two simultaneous edits to different fields and a fresh connection preserved both edits and the project. Scoped notification tests cover read, missing IDs and server-managed state. | Simultaneous edits to the same draft text retain existing last-write behavior. |
| Medium | Sensitive links in Recovery | Lightweight snapshots handled embedded shared links differently from portable archives. | Apply the same text cleaning on export and recovery, including older stored snapshots. | Nested text, encrypted snapshots and restore path regression tests. | Existing third-party copies of previously exported files cannot be recalled. |

## Calculation checks

Expected results below were calculated independently of the endpoint that returned the actual result. The implemented quote/invoice tax is a configured percentage of the discounted subtotal. These examples verify the software’s arithmetic.

| Inputs | Expected | Actual | Evidence |
|---|---|---|---|
| 3 × ₹100.01, 10% discount, 18% tax | ₹300.03 subtotal, ₹30.00 discount, ₹48.61 tax, ₹318.64 total | ₹318.64 | Server rejected caller totals as authoritative. Quote, converted invoice and persisted register agreed. |
| ₹318.64 issued, ₹80.25 cumulative received | ₹238.39 outstanding | ₹238.39 after both processes restarted | A stale competing edit returned 409. Full cumulative receipt of ₹318.64 produced ₹0 outstanding. |
| ₹2.50 with 64.60% discount | ₹1.62 discount, ₹0.88 total | ₹0.88 | A historical accepted ₹0.89 quote still converted at ₹0.89. |
| ₹0.30 scheduled, ₹0.29 advanced against the first ₹0.29 installment | No reminder on the covered installment | No reminder claimed for that installment | The positive control with no historic advance was still eligible. |
| ₹100.30 invoiced with ₹20.10 paid, separate paid ₹10.20 invoice, ₹0.10 + ₹0.20 expenses | ₹30.30 collected, ₹80.20 due, ₹0.30 expenses, ₹30.00 net | All four matched | Finance overview, pending amounts and expense records in an isolated database. |
| Expenses ₹7.50 travel, ₹1.50 custom category and ₹1.00 without category | 75%, 15%, 10% | 75%, 15%, 10% | Custom and uncategorized expenses both remained in the denominator. |
| ₹0.01 accepted quote, studio default splits payment in half | One payable ₹0.01, no zero installment | ₹0.01 single due date | Conversion remained editable. |
| ₹2,500 monthly Studio plan, local provider fixture | 250,000 paise, 15 seats | 250,000 paise, 15 seats | The provider’s current subscription controls access. Replayed events preserved the result. |
| Invalid inputs including 1.5 quantity, >100% discount, advance over total, and sub-paise expense | Validation rejects unsupported amounts | Rejected | Whole quantities are the current invoice contract. Missing advance on historical data is treated as zero. |

## Resets, reversals and data survival

- **Account scope.** Resetting appearance/sidebar preferences affects the signed-in user. Restarting studio setup changes the owner’s review step and revision. Team and business records persist. Revoking a session or changing a delegated password invalidates access under the existing session rules.
- **Business scope.** Draft cancellation, link expiry or revocation, archive, and moving an eligible item into Recovery have distinct effects. Recoverable record deletion takes a snapshot. Merge-restore adds missing IDs. The audit verified task restoration and guards on historical invoices. It did not treat moving a record to Recovery as a reversal of a client payment.
- **Whole personal installation.** Full replacement requires owner authorization, current credentials, an explicit phrase, a matching generation, the maintenance lease, the operator gate and the safety archive. Integrations remain paused after replacement until explicitly resumed. Commercial studio sessions cannot use this operation. This operation is intentionally capable of replacing financial history in the personal installation.
- **Identity support.** A commercial self-service forgotten-password token flow was not found. Token expiry/reuse for that feature has no implemented path. Password changes, session expiry/revocation, OAuth flow state and public link expiry have their own coverage.
- **Storage boundaries.** Two separately provisioned studio databases and real owner/staff sessions were exercised. Populated record isolation and public token resolution also have focused tests. The audit did not inspect any production documents, database contents or storage buckets.

## Additional regression evidence

| Status | Case | Observed result |
|---|---|---|
| Fixed and verified | An accepted quotation is replayed after its template changes | The first acceptance records its chosen stages. The stage writes and consumption of this snapshot commit together. Two retries after a failed second stage produced the two original stages. Replaying after a later intentional deletion left it deleted. Pre-upgrade accepted quotes without a snapshot do not pick up new defaults. |
| Fixed and verified | Two distinct clients have the same name | Contact history favors explicit links. A limited legacy fallback requires a matching identity with a unique email. An ambiguous unlinked invoice remains available in the invoice register. Dashboard gallery activity and counts use stored event, photo and client relationships. Older incorrect associations require manual review. |
| Fixed and verified | Legacy gallery creation, selection and cover | Creation with an explicit event ID associated the item only with that event. Repeating a desired selection or favorite state retained it. Repeated and competing cover requests kept one cover in a group. Deleting gallery items removed stored event references to those items. A confirmed cloud upload still returned its URL when writing optional studio activity failed in the fixture. Existing empty-body calls still toggle, so replay-safe clients should send their desired boolean value. |
| Fixed and verified | Legacy crew email at the UTC/India day boundary | On a UTC host at 18:35 UTC on 28 February 2028, the studio was already on leap day. Tomorrow’s window began at 18:30 UTC on 29 February. Reminders use 08:00 India time, skip duplicate/inactive roster names and continue after an individual failure. SMTP receipts after a timeout remain indeterminate. |
| Fixed and verified | Distinct records with historically large accepted amounts | A linked draft can preserve the amount already accepted on its quote even above the limit for ordinary new invoices. The new-invoice upper bound still applies to ordinary creation. No stored invoice was rewritten. |

## Remaining decisions and limits

| Classification | Area | Evidence or decision still needed |
|---|---|---|
| Confirmed open accounting ambiguity | Booking deposits, invoice advances and manually recorded income are distinct records. The legacy summary can count the same receipt twice if a user records it as both a booking payment and an invoice payment. The legacy fields called “annual” also have no period filter. | Define which record is authoritative, a shared allocation or bank-receipt identifier, and the studio fiscal-year start, timezone and recognition basis. The current Finance interface separates the books. The offline diagnostic bounds the possible overlap for linked records. No historical payment was merged, removed or reclassified. |
| Unsupported workflow | Customer payment refunds, credit notes, issued customer receipt documents, multiple tax components, inclusive tax and automatic payroll settlement | Specify the desired accounting flow, supported currencies, tax basis and provider contract. The existing expense-proof file is a different feature. A SaaS subscription payment is separate from a client invoice. |
| Partially verified | Provider delivery and settlement | Google sign-in/Calendar/Drive, payment-provider webhooks, SMTP, Gmail, WhatsApp, WABB, APNs, Cloudinary, Sheets and assistant integrations were inspected, gated, or exercised with fixtures according to the workflow table. Provider-side consent, TLS setup, subscription-plan configuration, real delivery, settlement, external retries and quotas need a designated sandbox account. |
| Confirmed operational limit | Worker/provider acknowledgements | Local transaction recovery, restart and replay were exercised. SMTP has no durable provider receipt per recipient in the legacy crew batch. A timeout after provider acceptance is ambiguous. Check provider history before retry. Invoice/quote workers conservatively preserve uncertain deliveries for review. A crash at every point in every external job was not simulated. |
| Compatibility limit | Database topology and mixed application versions | Transactions require a replica set or a compatible sharded MongoDB deployment. Standalone staffed calendar creation returned 503 and saved nothing. Unstaffed calendar creation succeeded there. Standalone legacy installations need a transaction-capable topology before using the affected multi-record writes. Rolling back to code that ignores the acceptance snapshot or reset generation reintroduces those risks. |
| Not independently verified | Subscription ownership and plan rotation | A five-studio ownership limit exists. Simultaneous attempts at that limit, changes to an existing merchant’s provider plan ID, and real-world peak billing-webhook throughput were outside the verified matrix. |
| Historical data not inspected | Financial overlap, old seat counts, ambiguous gallery links and pre-upgrade acceptance | No customer records were queried. The audit could prove examples using synthetic records only. An old accepted quote without a template snapshot cannot prove its intended stages. Staff can explicitly apply the intended template after checking it. |
| Not verified exhaustively | Peripheral and deployment-specific behavior | Complete endpoint list is supplied. No claim of a separate real-HTTP test for every route, high-volume latency, hosted CDN/object-store durability, distributed rate limits, every old import format, all password-provider behavior, every role on every endpoint, or live integration health. No separate freelancer login role was found. |

## Historical diagnostics

- `backend/scripts/reconcileWorkspaceSeats.js --workspace=<id>` defaults to reporting the active members, pending invites, stored seat count and expected count. On a disposable studio, the report showed 3 stored versus 1 expected. An explicit repair set 1, and a repeat made no change. The script refuses uncertain in-flight invitations and a missing active owner. It was never pointed at production.
- `node backend/scripts/auditLinkedReceipts.js < single-studio-projection.json` works offline. The input contains the minimum booking and invoice fields, including their stored IDs. The output contains aggregate counts and amounts in paise. One ₹100 booking and two linked receipts of ₹60 and ₹70 gave a possible double-count of ₹0–₹100. The separate ₹4 without a link remained unresolved. This check cannot establish a duplicate payment. It performs no repair.
- Older links based only on display names or other ambiguous text cannot be reconstructed reliably by a batch operation. Review the original document and booking before assigning an ID. The existing `repairEnquiryLinks.js` program is an explicit write tool. It was not used as a read-only diagnostic.

## Release and rollback

1. Review this branch against the commercial release baseline. Validate replica-set transactions and disposable restore with the exact deployment Node/MongoDB versions, hosting configuration and worker count. Confirm a usable backup of the registry, studio databases and relevant object storage.
2. Release matching frontend and backend versions. The personal reset and restore clients send an expected data generation. Refresh any old open personal recovery tabs. Complete rollout to all API instances before allowing recovery, acceptance replays, or multi-instance scheduling operations.
3. Using a designated test studio, repeat booking, quote acceptance, partial payment, and two simultaneous bookings. Check receipt download, worker status and API health. Monitor validation/conflict responses, failed delivery events and rejected webhooks. Inspect any financial discrepancies against actual allocation records.
4. A code rollback restores the prior application behavior. It does not reverse payments or inventory records created after release. Quiesce affected operations, retain their history, and interpret pending production-template snapshots before resuming an older worker. Keep destructive personal recovery disabled during any incompatible-version interval. Restore a database backup only under a separately authorized data-recovery procedure.

The branch adds an internal manual-creation receipt collection and optional state to existing documents. It includes updated protocol checks and stronger transaction requirements. No bulk migration or customer-data repair was performed. The new tenant-local receipt collection uses its built-in unique document ID. No additional index or record-ID rewrite is required. It grows by one small receipt per successful keyed create. Receipts are internal metadata and are excluded from portable business exports. Personal whole-workspace replacement rejects an older receipt generation. Individual same-ID task restore can resolve the original submission. Freshly opened forms start a new submission; encrypted enquiry drafts can restore the original key. An older API instance cannot enforce the new key protocol. Deploy the backend support before relying on frontend retry protection. The commercial blueprint keeps automatic publishing off. A removed item’s old submission returns 410. Restoring that specific item through Recovery returns it on replay.

## Verification and reproduction

The test runtime was Node 24.22.1 and MongoDB 8.0.11. Frontend and backend dependencies came from their respective lockfiles. All networked tests used synthetic fixtures and loopback services. The production blueprint pins a different Node patch version.

| Check | Result |
|---|---|
| Backend release baseline | 511 passed, 0 failed. |
| Audited backend with database tests enabled | 565 passed, 0 failed, 0 skipped, including the independently restarted HTTP/MongoDB journey. |
| Frontend suite | 411 passed, 0 failed, 0 skipped. Includes retry after an interrupted form submission and restoring an encrypted enquiry draft. |
| Actual backend startup | Started the real `server.js` against an empty disposable database, with the HTTP listener restricted to loopback. Index initialization and health passed, SaaS configuration reflected the test flags, and signed-out Tasks returned 401. |
| Production-mode commercial frontend build | Vite build passed. |
| Full frontend ESLint | **Failed on existing issues.** The baseline and review tree each reported 202 errors and 15 warnings. Matching by file, rule, severity, and first diagnostic line showed no added or removed diagnostics. |
| Syntax and patch hygiene | 79 changed JavaScript files passed syntax checks, JSX compiled by the frontend build, and Git whitespace checks passed. Backend package defines no separate lint, build or TypeScript command. |
| Devices and real providers | Headless Chromium exercised the actual Contact and Project form components against a synthetic HTTP service. Each retry after a 503 reused its key and a deliberately new form sent a different key. No physical-device browser or live provider settlement/consent test was performed. |

To repeat the integrated run, install the locked dependencies in a scratch checkout. Use an empty local replica set and a local `mongod` executable. Leave production environment files and all external service credentials out of the checkout. Run the following in `backend/`.

```sh
STUDIO_AUDIT_MONGO_PORT=27841 \
STUDIO_TEST_REPLICA_PORT=27841 \
STUDIO_AUDIT_MONGOD=/absolute/path/to/mongod \
NODE_ENV=test node --test tests/*.test.js integration/workspaceJourney.test.js
```

The port is the operator’s disposable replica set. The restart journey launches a second isolated instance and stops only its own processes. Running the regular test command without these options skips the opt-in database cases. For the commercial frontend use `npm test` and `VITE_STUDIO_DEPLOYMENT=commercial VITE_STUDIO_SAAS_ENABLED=true npm run build` in `frontend/`. The configured full lint command is `npm run lint`.

**Direct evidence in the branch**

- [HTTP and restart journey](../../backend/integration/workspaceJourney.test.js), [legacy gallery journey](../../backend/integration/legacyGalleryJourney.js) and [booking transaction/acceptance regressions](../../backend/tests/booking-transaction.test.js)
- [Monetary invariants](../../backend/tests/financial-integrity.test.js), [linked receipt diagnostic](../../backend/tests/linked-receipts.test.js), [receipt replacement](../../backend/tests/finance-receipt-transaction.test.js) and [invoice revision and workflow cases](../../backend/tests/invoice-workflow.test.js)
- [Seat and billing recovery](../../backend/tests/saas-seat-integrity.test.js), [manual creation retries](../../backend/tests/manual-creation-integrity.test.js), [manual create forms](../../frontend/test/manual-record-create.test.mjs) and [generation-checked workspace replacements](../../backend/tests/workspace-replacement-transaction.test.js)
- [Calendar assignments](../../backend/tests/calendar-assignments.test.js), [crew reminders](../../backend/tests/crew-reminder.test.js), [automation paging and scoping](../../backend/tests/studio-automation.test.js) and [notification updates](../../backend/tests/notification-activity.test.js)

## Changed files

Paths are relative to the review checkout. This list includes application changes, tests, reproducible fixtures and audit documentation.

| Directory | Files |
|---|---|
| `backend` | `WORKSPACE-BACKUP.md`, `server.js` |
| `backend/integration` | `legacyGalleryJourney.js`, `workspaceJourney.test.js`, `workspaceJourneyServer.js` |
| `backend/models` | `Finance.js`, `ManualCreationReceipt.js`, `Quotation.js`, `StudioConfig.js`, `StudioOperationLease.js`, `productionTemplateSchema.js` |
| `backend/routes` | `calendarRoutes.js`, `contactRoutes.js`, `dashboardRoutes.js`, `financeRoutes.js`, `galleryRoutes.js`, `invoiceRoutes.js`, `leadroutes.js`, `notificationRoutes.js`, `publicQuoteRoutes.js`, `receiptRoutes.js`, `studioArchiveRoutes.js`, `studioSecurityRoutes.js`, `taskRoutes.js` |
| `backend/saas` | `billing.js`, `plans.js`, `routes.js`, `service.js` |
| `backend/scripts` | `auditLinkedReceipts.js`, `reconcileWorkspaceSeats.js` |
| `backend/services` | `ReminderService.js`, `enquiryPipeline.js`, `googleCalendarService.js`, `invoiceDelivery.js`, `productionTemplates.js`, `studioArchive.js`, `studioAutomation.js`, `studioRecovery.js` |
| `backend/tests` | `booking-transaction.test.js`, `calendar-assignments.test.js`, `calendar-connection.test.js`, `calendar-date-range.test.js`, `cloudinary-storage.test.js`, `contact-records.test.js`, `crew-reminder.test.js`, `finance-receipt-transaction.test.js`, `finance-receipts.test.js`, `financial-integrity.test.js`, `linked-receipts.test.js`, `manual-creation-integrity.test.js`, `notification-activity.test.js`, `production-task-integrity.test.js`, `quote-workflow.test.js`, `saas-access-billing.test.js`, `saas-billing-reconciliation.test.js`, `saas-seat-integrity.test.js`, `studio-automation.test.js`, `studio-session-recovery.test.js`, `studio-settings.test.js`, `workspace-archive.test.js`, `workspace-replacement-transaction.test.js` |
| `backend/utils` | `archiveText.js`, `calendarDateRange.js`, `createLead.js`, `documentDefaults.js`, `invoiceDeletion.js`, `invoiceValues.js`, `legacyGalleryRecords.js`, `manualCreation.js`, `paise.js`, `productionTask.js`, `quoteLifecycle.js`, `studioCalendar.js`, `studioRecords.js`, `workspaceArchive.js` |
| `docs/studio-x-os` | `backend-integrity-audit.md`, `backend-integrity-inventory.md` |
| `frontend/src/admin/components/contacts` | `ContactWorkflowUI.jsx` |
| `frontend/src/admin/components/crm` | `LeadForm.jsx`, `TaskList.jsx` |
| `frontend/src/admin/components/operations` | `invoiceSave.js` |
| `frontend/src/admin/components/projects` | `ProjectOperations.jsx` |
| `frontend/src/admin/components/settings` | `WorkspaceBackupPanel.jsx`, `WorkspaceResetDialog.jsx` |
| `frontend/src/admin/components/studio` | `StudioLeadDetails.jsx`, `StudioLeadForm.jsx` |
| `frontend/src/admin/pages` | `PostProduction.jsx` |
| `frontend/src/offline` | `draftVault.js` |
| `frontend/src/utils` | `recordCreationKey.js` |
| `frontend/test` | `manual-record-create.test.mjs`, `offline-drafts.test.mjs` |
