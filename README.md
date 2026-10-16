# Team Alpha Studio OS

Private, single-studio wedding photography operations, with an existing public portfolio and client portal. React/Vite frontend; Express/Mongoose backend.

## Workspace

Sign in at `/auth` and open `/admin` for the studio overview. The redesigned workspace includes Enquiries, converted-lead Projects, Crew & scheduling, Post production, Client galleries, Finances, Conversations, Activity, Integrations, and Team & access. The public portfolio and restricted client portal keep their existing routes.

## Local development

Use Node.js 24 and npm.

1. In `backend/`, run `npm ci --legacy-peer-deps`. This flag is required by the existing Cloudinary/storage adapter peer-dependency constraint.
2. Copy `backend/.env.example` to `backend/.env` and configure MongoDB, JWT and the integrations you use. Never commit secrets.
3. In `frontend/`, run `npm ci`. Copy `.env.example` to `.env` if needed.
4. Start the backend with `npm run dev` from `backend/` and the frontend with `npm run dev` from `frontend/`.

During local Vite development, `/api` and `/socket.io` proxy to port 5000. Set `VITE_API_URL` to the backend HTTPS origin before a production build when frontend and backend use separate hosts. The shared API resolver also supports direct local network testing.

## Checks

- Frontend: `npm test`, `npm run lint:studio`, `npm run build`.
- Backend: `npm test`, `node --check server.js`.
- `.github/workflows/studio-checks.yml` runs these checks on pull requests and the redesign branch.

`lint:studio` covers the redesigned screens and shared components. The existing repository-wide `npm run lint` also includes inherited public/client/legacy modules, which have not received a full lint remediation in this change.

Build output and Vite caches are generated locally rather than committed. The original frontend lockfile was unreadable; the replacement is valid JSON and supports `npm ci`. A frontend production host must run `npm ci` and `npm run build` before `npm start`.

## Incoming enquiry webhook

`POST /api/webhooks/enquiries` creates CRM enquiries using a server-side Bearer secret and a durable idempotency key. Configure a unique random `ENQUIRY_WEBHOOK_SECRET` with at least 32 characters on the backend; leave it unset to disable the endpoint. Admins can inspect configuration and copy the endpoint/payload at `/admin/integrations`.

See [Webhook setup and payload](docs/ENQUIRY_WEBHOOK.md).

## Release review

Changes are prepared in `feat/premium-redesign-revepod-audit` for review. Follow [implementation notes](docs/STUDIO_OS_IMPLEMENTATION.md) and [the redesign plan](docs/PREMIUM_REDESIGN_PLAN.md) before release. Real MongoDB/provider regression checks and owner deployment approval remain release steps. Never commit credentials, customer exports or local preview fixtures.
