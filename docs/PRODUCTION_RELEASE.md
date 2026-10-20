# Production release

The application uses two Node web services and the existing MongoDB database. Keep the existing hosting identities, domain, database and integration secrets. A Git push prepares source; it proves a production release only after the hosting provider deploys that commit and the live checks below pass.

## Service settings

Use Node.js 24 for both services. With Render root directories configured as shown, use:

| Service | Root directory | Build command | Start command |
| --- | --- | --- | --- |
| Public website and Studio OS frontend | `frontend` | `npm ci && npm run build` | `npm start` |
| Studio OS API and background jobs | `backend` | `npm ci --legacy-peer-deps` | `npm start` |

Use **Node web services**, including for the frontend. Its Express server serves the built SPA and `/api/website` gateway. Uploading only `dist` to a static host would omit enquiry delivery and live reviews. Render supplies `PORT`; both services bind to `0.0.0.0`.

Configure each service to use the approved release branch/commit. The repository's GitHub workflow runs checks; it does not deploy to Render. Follow the existing host's deployment process through reviewed pull requests. Do not push directly to `main` or create replacement services/databases without checking the existing deployment.

## Production configuration

Store private values in each service's environment settings. Never commit `.env` files, credentials or production database exports.

### Frontend service

Set these before the production build:

- `VITE_API_URL`: real HTTPS backend origin, without `/api` or a trailing slash. The frontend production server does **not** provide Vite's `/api` or `/socket.io` proxy. A missing or `localhost` value breaks admin requests on visitors' devices. Rebuild after changing it.
- `VITE_SITE_ORIGIN`: canonical HTTPS website origin for metadata, if configured.

Set these in the running frontend Node service:

- `NODE_ENV=production` and `WEBSITE_PUBLIC_ORIGIN`: canonical HTTPS website origin, without path/query/fragment.
- `WEBSITE_ENQUIRY_WEBHOOK_URL`: backend HTTPS origin plus `/api/webhooks/enquiries`.
- `WEBSITE_ENQUIRY_WEBHOOK_SECRET`: the same 32+ character secret as backend `ENQUIRY_WEBHOOK_SECRET`, with no spaces.
- Optional Google reviews: `GOOGLE_PLACES_API_KEY`, verified `GOOGLE_PLACE_ID`, and `WEBSITE_REVIEWS_ENABLED`.
- Optional approved content: `WEBSITE_CONTENT_FILE`, or `WEBSITE_CONTENT_URL` with `WEBSITE_CONTENT_ALLOWED_HOSTS`.

Server-only variables must never have a `VITE_` prefix. The production frontend server reads its environment directly; it does not load a local `.env` file. See [website configuration](../frontend/WEBSITE-CONFIGURATION.md) for publication, origin validation, rate limits and Google attribution requirements.

Without webhook configuration the enquiry form reports that online delivery is being configured and offers direct contact. It does not confirm a saved enquiry. Without Google configuration, reviews use a profile/search link without invented ratings. These fallbacks permit honest presentation; they do not verify the missing integrations.

### Backend service

Preserve the existing `MONGO_URI`, `JWT_SECRET`, and `VAULT_SECRET`; do not generate replacement values during an ordinary code release. Set `NODE_ENV=production` and `FRONTEND_URL` to the actual frontend HTTPS origin. The latter controls CORS, shared quote/invoice URLs and OAuth return destinations.

Configure the integrations used by the studio:

| Capability | Environment names |
| --- | --- |
| Website enquiries | `ENQUIRY_WEBHOOK_SECRET` |
| Image uploads and document covers | `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` |
| Quote/invoice mail | `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`; existing Gmail transport can use `EMAIL_USER`, `EMAIL_PASS` |
| Existing reminder mail | `EMAIL_USER`, `EMAIL_PASS` |
| Google OAuth/calendar | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `WEBHOOK_URL` |
| Google Drive/Sheets service account | `GOOGLE_CLIENT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_SHEET_ID` where used |
| Existing optional system-admin login | `ADMIN_EMAIL`, `ADMIN_PASSWORD`, only if already used by the studio |

Google redirect/webhook URLs must point to the deployed backend HTTPS endpoints and match the provider configuration. Do not enable `STUDIO_LOCAL_PREVIEW` in production. Missing SMTP or Cloudinary settings produce explicit delivery/upload errors; do not substitute fixture responses.

## Database and deployment sequence

1. Record the current frontend/backend deployment IDs and commit SHAs. Confirm a restorable backup or snapshot of the existing MongoDB database before introducing new workflows.
2. Run frontend tests, `npm run lint:studio` and `npm run build`; run backend tests and `node --check server.js`. Build with the production API origin, rather than uploading a local development build.
3. Verify the existing database can create the additive collections and indexes. The release adds contacts, studio projects, contact documents, quotation delivery records and project messages; it must preserve existing client, quotation, invoice, gallery and payment records.
4. Check unique indexes against actual records before accepting traffic. Important definitions are listed below. If duplicates conflict, investigate and reconcile the affected relationship with the studio; do not purge or silently delete records.
5. Deploy the backend release first. Check `/api/health` returns HTTP 200 and JSON with `ready: true` and `database: "Connected"`. It returns HTTP 503 until connection and required index initialization succeed, and on a later database disconnect. Other API routes return 503 while unavailable. Confirm production CORS accepts the actual frontend origin.
6. Deploy the corresponding frontend commit with its correct build/runtime variables. Check the homepage, `/auth`, an authenticated admin screen, a direct SPA refresh and `/api/website/content` on the real host.
7. Verify a controlled enquiry and retry create exactly one lead in the existing admin console. Verify quotation acceptance produces one draft invoice, studio issue reveals the payment schedule, and the same private client link retains the correct project. Use an approved test record and recipient; never send test messages to an unrelated client.
8. Confirm the expected public gallery/film assets, mobile layout, configured real reviews and integration status. Measure performance on this final hosting configuration. Retain the deployment IDs and results for rollback.

Backend startup activates quotation/invoice delivery workers, reminder jobs and Google polling. Review any existing due delivery records before switching production traffic; do not start a second backend against production merely to preview the interface.

### Indexes to verify

| Model | Unique keys / condition |
| --- | --- |
| `Lead` | `webhookEventId` (sparse); `studioProjectId` (partial ObjectId) |
| `Quotation` | `shareTokenHash` and `documentNumber` (each partial string) |
| `Invoice` | `sourceQuotation` (partial ObjectId); `shareTokenHash` (sparse) |
| `QuoteDelivery` | `key` |
| `ProjectMessage` | compound `quotation`, `author`, `requestId` |

Use the model definitions for exact partial-filter options. Startup awaits non-destructive `createIndexes()` for Lead, Quotation, Invoice, StudioContact, StudioProject, ContactDocument, ProjectMessage and QuoteDelivery before marking the API ready or starting workers. It never calls `syncIndexes()` or drops existing indexes. A connection/index failure leaves the API unavailable and workers unstarted; correct the configuration or index conflict and restart the service. The enquiry webhook also explicitly ensures its idempotency index, as described in [webhook setup](ENQUIRY_WEBHOOK.md).

## Rollback

Roll back each Node service to its recorded previous deployment/commit using the hosting provider. Keep the correct origins and existing secrets. Check API/database health and admin access again. If reverting backend code, first assess whether newly created quotation, invoice or project records require the newer schema; pause traffic or delivery workers when needed to avoid inconsistent processing.

Code rollback does not require deleting the additive collections or indexes. Do not automatically restore an older database snapshot over newer client/payment writes. Any database restoration needs a separate recovery decision and a plan to preserve writes since the backup. Do not run purge, cleanup, deep-repair or database-diet scripts as part of deployment.

Local `preview-server.cjs`, preview accounts, temporary sample data, screenshot-export helpers and generated builds are development artifacts and must never be shipped as the production backend.

## Release verification — 20 October 2026

The complete release includes the luxury public frontend, client/project enquiry synchronization, quotation/invoice approval and sharing, production progress/support, and mobile Studio OS updates. Deployment hardening adds single-use browser-bound Google OAuth with PKCE, current-user REST permission checks, private authenticated Drive previews/uploads, and database/index readiness before API traffic or workers.

Local checks: 140 backend tests and 52 frontend tests pass; lint:studio, lint:public, lint:mobile and changed private-media component lint pass; production build passes (Vite 7.3.7, 3.11 seconds on this Mac). The broad inherited legacy-directory lint still has unrelated pre-existing errors and is not claimed clean. No live database writes were used for these checks. Local dist is not uploaded: Render must build source using its verified production VITE_API_URL.

The owner requested new free Render services and a new free MongoDB database. No preview fixtures or sample data should be imported. On a fresh database, configure ADMIN_EMAIL and ADMIN_PASSWORD privately for initial bootstrap sign-in, then create saved team accounts. JWT_SECRET and VAULT_SECRET must be strong private values; keep them stable after launch. Provider account terms and credential creation require the owner's direct input. Free hosting can sleep; background scheduled jobs require a running backend.
