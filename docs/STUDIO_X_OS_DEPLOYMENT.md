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

## Studio Google Calendar

Enable Google Calendar API in the Google Cloud project used by the commercial Google sign-in client. In Google Auth Platform, add the `calendar.events.owned` scope under Data Access and allow the studio owner's account under Audience when the app is in testing. The app also requests `userinfo.email` to identify the chosen calendar account. The existing registered `SAAS_GOOGLE_REDIRECT_URI` handles both Google sign-in and the separate Calendar consent flow. Keep the commercial backend's `VAULT_SECRET` stable and at least 32 bytes.

In the studio owner's Calendar screen, choose **Connect Google** and select a Google account dedicated to this studio. A primary calendar can be connected to one studio at a time. Google asks for event access separately from sign-in. The team can see events imported from that account's primary calendar. New studio calendar events sync to it. **Disconnect** stops sync, releases the connection, and retains the events already in Studio X OS. Reconnecting the same account reuses its event mappings. The commercial database must support multi-document transactions for connection changes.

## Gmail

1. Enable Gmail API in the Google Cloud project used for Studio X OS. Add the `https://www.googleapis.com/auth/gmail.readonly` scope in the Google Auth Platform. If the OAuth app is in testing, add each intended mailbox owner as a test user. Google may require verification for broader availability. [Gmail API scopes](https://developers.google.com/workspace/gmail/api/auth/scopes)
2. The commercial API uses the same registered `SAAS_GOOGLE_REDIRECT_URI` as Google sign-in when the Gmail-specific settings are unset. For a dedicated Gmail callback, register `https://studio-x-os-api.onrender.com/api/integrations/gmail/callback` with the selected Google web client and set `GMAIL_REDIRECT_URI` to that exact URL on the backend. If using a separate Gmail OAuth client, set both `GMAIL_CLIENT_ID` and `GMAIL_CLIENT_SECRET` privately along with the dedicated callback. [Google OAuth for web server apps](https://developers.google.com/identity/protocols/oauth2/web-server)
3. After the backend is ready, sign in to Studio X OS and choose **Email → Connect Gmail**. The mailbox owner grants read access in Google. Inbox, Sent and search use that account’s connection. Email composition opens Gmail for the owner to send manually.

Gmail stores an encrypted account connection in the administrator’s workspace. Keep the existing `VAULT_SECRET` stable. Disconnecting removes this Gmail connection without revoking the Google client’s separate Calendar grant.

## ChatGPT, Claude and WhatsApp Web

The workspace owner sets up ChatGPT and Claude in [Integrations](ASSISTANT_CONNECTIONS.md) using the provider’s API credentials. From **WhatsApp**, choose **Open WhatsApp Web** and link your phone in WhatsApp’s **Linked devices**. This opens the official web app in a separate tab. For app-managed messaging, see the separate [WhatsApp Business workspace](WHATSAPP_BUSINESS.md).
