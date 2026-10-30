# Studio OS SaaS foundation

Status: local implementation, 26 October 2026. This is a gated foundation for a commercial product, not a completed production launch. No production migration or deployment is implied by these changes.

The existing Team Alpha installation continues to use its original database and authentication. New independent studios use separate operational databases. Both SaaS feature flags remain disabled by default. The current local environment has no MongoDB connection configured, so real database provisioning and cross-studio workflows have not been verified end to end against Atlas.

## Implemented flows

- `/signup` contains studio registration and the initial 14-day Starter trial. Registration is admitted only when both SaaS gates allow it. A saved SaaS identity can belong to several studios; account credentials are stored as password hashes in the global identity directory.
- `/auth` supports SaaS studio sign-in alongside the established Team Alpha sign-in. A workspace picker lists only the account's active memberships, and switching issues a session for the selected studio.
- `/admin/workspace` provides workspace, team and subscription controls. `/admin/subscription` opens the subscription view. SaaS `/admin/users` uses team management instead of the legacy password-vault account manager.
- An owner can reserve a seat and create an invitation for a specific email and an `admin` or `staff` role. The shareable `/join/:token` link is returned once; the server stores its hash. Invitation acceptance requires the addressed account's password, or creation of that account. Invitation expiry, cancellation, role changes and member removal are handled server-side. Invitations currently use manual link sharing; they are not automatically emailed.
- Owners manage membership and subscription actions. Administrators use studio operations while owner-only security and recovery checks still apply. Staff access follows route-level policies: general records and finance can be read, and selected calendar, task, crew and client-support actions are permitted. Quotation/template management, invoice editing, membership, studio configuration changes and integration administration remain restricted. Permissions are enforced by the API, not just hidden buttons.
- A current trial or active subscription permits normal authorized operations. An ended trial, past-due subscription or cancelled subscription makes the workspace read-only while preserving access to its records and renewal controls. Membership removal and session revocation are checked again on subsequent requests.
- Quotes and invoices can use the existing client smart-link flow. New links include a workspace routing prefix plus a random secret; the complete token is hashed. Legacy links retain their existing format. A prefixed link resolves only an active, provisioned workspace and never retries against Team Alpha data if lookup fails. Public smart-link requests do not inherit an unrelated viewer's signed-in studio role.

## Data isolation and compatibility

The global control-plane models are `SaaSAccount`, `SaaSWorkspace`, `SaaSMembership`, `SaaSInvitation` and `SaaSBillingEvent`. A workspace has a server-owned identity, provisioning state, plan, membership limits and immutable database name.

Each new studio database is named `studio_<24-character-workspace-id>`. The browser cannot choose a database name. `tenantContext.js` validates workspace identity and database name; `tenantModels.js`, installed before operational model imports, routes model calls, collections, documents and population to the selected connection. Existing singleton configuration and indexes therefore remain local to each database. Request authentication resolves the global account and active membership before operational access begins.

Provisioning creates the studio database's model indexes, an initial studio profile and owner membership before marking the workspace active. Partial provisioning is marked failed rather than admitted as an active studio. An account may own up to five studios through the current API.

Realtime events use a separate namespace for each studio. Workspace workers run the legacy installation once, then each active SaaS workspace when SaaS is enabled. Job failure in one studio does not stop the next. Quotation delivery, invoice delivery, backups, automation and Google polling execution are scoped. Team Alpha's existing records are not automatically copied, relabelled or migrated.

The original public Team Alpha photography website remains a single studio website. Separate tenant websites, studio-specific enquiry webhook keys, custom domains and a tenant migration tool are not implemented by this foundation.

## Monthly subscriptions

Razorpay Subscriptions is the selected provider. Starter's five-seat limit is the chosen initial tier; monthly prices have not been approved or populated in this implementation.

| Plan ID | Team seats | Initial trial |
| --- | ---: | --- |
| `starter` | 5 | 14 days for a new studio |
| `studio` | 15 | No separate trial |
| `scale` | 50 | No separate trial |

The owner counts as a seat. Pending invitations reserve seats. Database-side comparisons prevent a concurrent invite from exceeding the current seat limit, and subscription changes check current reserved seats. These tiers currently differ by seats; storage, client, project and request quotas are not implemented.

The checkout endpoint chooses an approved server-configured monthly plan and checks its Razorpay period, interval, currency and amount. It creates or reuses a stored subscription and uses a checkout lease to avoid duplicate mandates. Existing nonterminal mandates require reconciliation before another is created. The current checkout uses 120 monthly billing cycles.

Browser checkout completion alone does not activate paid access. The server verifies the payment signature and fetches the matching provider subscription. Webhooks validate `X-Razorpay-Signature` against the raw request bytes, deduplicate provider event IDs and reconcile server-side state. A workspace lease and conditional updates serialize billing reconciliation. Ambiguous provider timeouts remain in a reconciliation state instead of creating another mandate. Cancellation, an unresolved checkout and changes to an existing mandate may still require support; a complete self-service billing recovery and cancellation experience is a launch dependency.

Official provider references: [Create a subscription](https://razorpay.com/docs/api/payments/subscriptions/create-subscription/), [subscription integration](https://razorpay.com/docs/payments/subscriptions/integration-guide/), and [webhook verification and retry behavior](https://razorpay.com/docs/webhooks/validate-test/).

## Configuration

Keep secrets in private backend deployment settings. Never put database credentials, the JWT secret, Razorpay key secret or webhook secret into frontend code, `VITE_*` values, screenshots or Git.

| Backend variable | Purpose / current default |
| --- | --- |
| `SAAS_ENABLED` | New workspace sessions, APIs and tenant worker execution; disabled unless exactly `true`. Keep disabled pending staging verification. |
| `SAAS_SIGNUP_ENABLED` | Public studio registration; disabled unless exactly `true`. It is a separate gate from existing tenant access. |
| `SAAS_TRUST_PROXY_HOPS` | Optional trusted proxy count (`1` or `2`) used for source-IP throttling. Set only after verifying the deployment's proxy topology. |
| `MONGO_URI` | Base database connection. The database user must have the required permissions to create and operate the intended studio databases and indexes. The existing Team Alpha database must remain intact. |
| `JWT_SECRET` | Stable backend session signing secret. |
| `FRONTEND_URL` | Approved frontend origin for invitation links and existing document links; use HTTPS in production. It is validated before reserving invitation seats. |
| `SAAS_STARTER_MONTHLY_INR` | Approved whole-rupee Starter monthly price; no approved default. |
| `SAAS_STUDIO_MONTHLY_INR` | Approved whole-rupee Studio monthly price; no approved default. |
| `SAAS_SCALE_MONTHLY_INR` | Approved whole-rupee Scale monthly price; no approved default. |
| `RAZORPAY_STARTER_PLAN_ID` | Matching provider monthly INR Starter plan. |
| `RAZORPAY_STUDIO_PLAN_ID` | Matching provider monthly INR Studio plan. |
| `RAZORPAY_SCALE_PLAN_ID` | Matching provider monthly INR Scale plan. |
| `RAZORPAY_KEY_ID` | Provider key ID for the selected test or live environment. |
| `RAZORPAY_KEY_SECRET` | Private provider API secret; never exposed to the browser. |
| `RAZORPAY_WEBHOOK_SECRET` | Separate secret for the backend `/api/saas/billing/webhook` endpoint. |
| `VAULT_SECRET` / `BACKUP_SECRET` | Preserve existing stable recovery keys where the original studio uses vault/recovery features. SaaS sign-in passwords do not use the reversible legacy vault. |

The frontend continues to use `VITE_API_URL` for its backend origin. No frontend Razorpay secret variable is required. A plan with missing pricing or provider configuration displays a configuration dependency and cannot start checkout. Test and live provider credentials and plan IDs must never be mixed.

## Integrations and launch dependencies

New studios do not inherit Team Alpha's Google, Gmail, WhatsApp, Sheets, Drive, gallery or legacy chat connections. Those integration APIs are blocked for tenant sessions until independent connection flows are implemented. Legacy SMTP delivery is disabled in a SaaS context, including quotation/invoice delivery and crew assignment/reminder emails. Manual quote/invoice link sharing remains available. Existing Team Alpha integration behavior continues in the legacy context.

Before enabling a public beta or taking subscription payments, complete and verify:

1. Approve monthly prices, configure matching Razorpay test plans and verify checkout, activation, renewal, failed payment, cancellation, duplicate events, reordered events and timeout reconciliation. Configure live keys and the live webhook only after test-mode sign-off.
2. Implement a verified-email account flow, secure password recovery and an operational transactional email pipeline. Current password sign-in and manual invitations are not a complete commercial identity lifecycle.
3. Build studio-owned integration credentials/consent and signed, authorized private file paths. Add tenant-specific enquiry intake before advertising website-to-CRM delivery for independent studios.
4. Verify actual Atlas provisioning permissions and index creation. Run real two-studio tests across CRUD, guessed IDs, populate/aggregate/raw collection calls, public smart links, realtime, queued jobs, backups, restores and concurrent requests. Test membership revocation, workspace switching and expired trials from separate browsers.
5. Prepare a dry-run legacy data migration with counts, recovery backup and rollback verification if Team Alpha is to become a SaaS workspace. No automatic migration currently exists.
6. Complete production ingress rate limiting, monitoring, database connection/capacity planning and recovery operations. The local in-process credential limiter is not a shared limit across multiple backend instances.
7. Complete product terms, privacy disclosures, billing/refund communication, customer support and cancellation/reconciliation operations for the actual commercial service.

Do not turn the feature flags on as a substitute for these checks. Local unit tests and a successful frontend build do not establish production tenant isolation or successful real payment collection. The current local preview cannot demonstrate those outcomes without a connected test database and provider test configuration.

## Implementation references

- Backend: `backend/saas/` contains context/model dispatch, global registry, access policy, provisioning, invitations, plans, billing, smart-token routing, workers and realtime support.
- Frontend: `frontend/src/saas/` contains signup/invitation pages, workspace switching, workspace/team/subscription UI and API helpers.
- Tests: `backend/tests/saas-*.test.js` and `frontend/src/saas/workspaceValues.test.mjs` cover targeted routing, permission, token, worker and billing behavior. They complement existing Studio OS tests; they do not replace Atlas and provider staging tests.
