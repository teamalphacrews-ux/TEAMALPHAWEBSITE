# Team Alpha Studio OS

Private, single-studio wedding photography operations and a public editorial photography website. React/Vite frontend; Express/Mongoose backend.

## Workspace

Use **Studio login** on the public website, or sign in at `/auth`, and open `/admin` for the studio overview. Studio OS includes Enquiries, Contacts, Projects, Quotations, quote templates, Finance, Calendar, Crew & scheduling, Post production, Data & backups, Conversations, project support, Activity, Integrations, Settings, and Team & access.

Public pages include the portfolio, wedding stories, films, studio, collections and enquiry form. Public client login and portal navigation have been removed. Existing client/project records remain intact. Private quotation and invoice links continue to work without a client account; accepted quotation links show the project's issued invoice, payment schedule and published production updates.

## Local development

Use Node.js 24 and npm.

1. In `backend/`, run `npm ci --legacy-peer-deps`. This flag is required by the existing Cloudinary/storage adapter peer-dependency constraint.
2. Copy `backend/.env.example` to `backend/.env` and configure MongoDB, JWT and the integrations you use. Never commit secrets.
3. In `frontend/`, run `npm ci`. Copy `.env.example` to `.env` if needed.
4. Start the backend with `npm run dev` from `backend/` and the frontend with `npm run dev` from `frontend/`.

During local Vite development, `/api` and `/socket.io` proxy to port 5000. Leave `VITE_API_URL` empty for same-network Vite testing; `localhost` would refer to each visiting device. Run the frontend with `npm run dev -- --host 0.0.0.0` and keep the Mac and other devices on the same network.

For separate production hosts, set `VITE_API_URL` to the real backend HTTPS origin **before building**. The production frontend server does not provide Vite's admin API/socket proxy. The public enquiry/reviews/content gateway runs in the frontend Node service and uses server-only environment variables; see [website configuration](frontend/WEBSITE-CONFIGURATION.md).

## Checks

- Frontend: `npm test`, `npm run lint:studio`, `npm run build`.
- Backend: `npm test`, `node --check server.js`.
- `.github/workflows/studio-checks.yml` runs these checks on pull requests and the redesign branch.

`lint:studio` includes the redesigned screens, public website and shared mobile components. The repository-wide `npm run lint` also includes inherited client/legacy modules, which have not received a full lint remediation in this change.

Build output and Vite caches are generated locally rather than committed. The original frontend lockfile was unreadable; the replacement is valid JSON and supports `npm ci`. A frontend production host must run `npm ci` and `npm run build` before `npm start`.

## Incoming enquiry webhook

`POST /api/webhooks/enquiries` creates CRM enquiries using a server-side Bearer secret and a durable idempotency key. Configure a unique random `ENQUIRY_WEBHOOK_SECRET` with at least 32 characters on the backend; leave it unset to disable the endpoint. Admins can inspect configuration and copy the endpoint/payload at `/admin/integrations`.

See [Webhook setup and payload](docs/ENQUIRY_WEBHOOK.md).

## Release review

Public redesign work is prepared in `feature/team-alpha-luxury-frontend-redesign`, based on the earlier Studio OS branch. Follow the [production release instructions](docs/PRODUCTION_RELEASE.md), [implementation notes](docs/STUDIO_OS_IMPLEMENTATION.md), and [website delivery report](frontend/REDESIGN-DELIVERY.md). Release through reviewed pull requests; never push directly to `main`. Publish only with the owner's approval and verify the deployed MongoDB/provider connections. Never commit credentials, customer exports, generated builds or local preview fixtures.
