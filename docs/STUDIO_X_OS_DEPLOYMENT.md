# Studio X OS commercial beta

Target domain: **studioxos.com** (GoDaddy). Keep the personal Team Alpha website,
API, database, signing keys and provider credentials separate.

## Hosting

Use `render.commercial.yaml` from `feature/studio-x-os-commercial-beta`, or create
equivalent services in a separate Studio X OS project. The frontend is a static
site; the backend is a Node service. The free backend is suitable for this gated
beta only and can sleep. It is not the always-on production launch architecture.

1. Provision a separate MongoDB cluster/database principal for commercial data.
   The SaaS registry database and dynamically provisioned `studio_<id>` databases
   must be writable by this principal. Do not use the personal Team Alpha URI.
2. Configure `MONGO_URI` privately. Generate fresh stable `JWT_SECRET` and
   `VAULT_SECRET`; save them in the hosting provider, never Git or frontend values.
3. Set backend `API_PUBLIC_URL` to its actual HTTPS service URL. Set frontend
   `VITE_API_URL` to that same origin (without `/api`) before building.
4. Backend `FRONTEND_URL` and frontend `VITE_SITE_ORIGIN` are
   `https://studioxos.com`. The frontend must set
   `VITE_STUDIO_DEPLOYMENT=commercial` and `VITE_STUDIO_SAAS_ENABLED=true`.
5. Keep `SAAS_ENABLED=true`, `SAAS_SIGNUP_ENABLED=false`,
   `WORKSPACE_RECOVERY_ENABLED=false` and `APNS_ENABLED=false`.
6. Verify `/api/health` reports ready and `/api/saas/config` reports signup
   disabled. Confirm the root homepage, login, signup-closed state and client
   routes from the actual commercial build before connecting DNS.
7. Add `studioxos.com` in the new static site's Custom Domains. Use the exact DNS
   values Render provides; replace only parked web records. Preserve mail, DMARC,
   nameservers and unrelated records. Verify apex, www, HTTPS and SPA reloads.

## Release gates

This release publishes a branded product beta, not paid public onboarding.
Registration, provider buttons and payments must reflect actual readiness.

Before opening signup, verify two independent studios against a disposable
replica-set database: provisioning, CRUD isolation, public tokens, socket events,
background jobs, membership changes and account recovery. Complete per-studio
email/integration ownership, recovery/restore coverage and subscription lifecycle
tests. Set approved INR monthly plan prices and Razorpay plan IDs only after owner
approval. The Starter plan has five seats; no price has been approved.

Google/Apple commercial sign-in requires separate identity OAuth clients described
in `STUDIO_OS_SOCIAL_AUTH.md`. Personal Calendar/Gmail credentials are not suitable.
Do not copy personal administrator bootstrap credentials into the commercial API.

## Rollback

Record the deployed frontend/backend commit and environment variable names. Deploy
the previous commercial commit to roll back application code; do not restore or
alter databases merely to roll back UI. Keep signup closed during rollback and
verify API readiness. Never use personal service deployment controls for this app.
