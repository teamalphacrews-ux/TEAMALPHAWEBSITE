# Gmail integration

This email-only change is based on `release/team-alpha-production` at `aaaa6d4438c4a1029b854d15803f19a2b0e95e8b`. It ports the existing Gmail module without the paused dashboard, settings redesign or WhatsApp work. Existing saved-administrator authentication, Calendar, database records and vault key are preserved.

## User experience

Studio → Email, Integrations and Settings link to `/admin/email`. Each saved administrator connects their own Gmail account using `gmail.readonly`. They can browse Inbox, Sent and All mail (including archived mail, excluding Spam/Trash), use Gmail search, paginate 25 results at a time, read plain-text previews and open the original message in Gmail. Attachment names are shown; downloads and original formatting open in Gmail.

Reads happen on demand. Opening a message does not mark it read. Messages are not copied into MongoDB. Only each administrator's encrypted connection/refresh credentials are stored. No compose, send, mailbox modification, background synchronization, shared team mailbox or extra Google permissions are introduced. Disconnecting Gmail removes its local connection and pending OAuth state without revoking Calendar's grant.

The preview account cannot authorize or read real Gmail, including cached UI paths. Message previews render text rather than remote images or active HTML. Requests are cancellable and bounded to 75 seconds to accommodate the current free backend's cold start. OAuth handoffs accept only the configured backend origin/path and a single opaque ticket.

## Backend configuration

Reuse existing `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`; a dedicated Gmail client is optional and requires both `GMAIL_CLIENT_ID` and `GMAIL_CLIENT_SECRET`. Never copy these into frontend variables or source control. Preserve the existing `VAULT_SECRET`, `JWT_SECRET` and `MONGO_URI`.

Required callback: `GMAIL_REDIRECT_URI=https://team-alpha-api.onrender.com/api/integrations/gmail/callback`.

Register that exact URI as an additional redirect in the existing Google OAuth web client; keep the Calendar callback. The backend `FRONTEND_URL` remains `https://team-alpha-studio.onrender.com`, and the frontend's existing `VITE_API_URL` must point to the backend origin. The two Gmail models are included in startup index readiness.

Gmail API was enabled in the existing Team Alpha Studio OS Google Cloud project during setup. At review time, the additional OAuth callback, `gmail.readonly` consent-scope entry and Render callback setting are prepared but unsaved. No new secret was generated or copied. Save these only with approval to publish this email-only update. After deployment, the saved Studio OS administrator must complete Google's actual Gmail consent flow; enabling the API alone does not connect a mailbox.

Google classifies `gmail.readonly` as restricted. Check the project's Audience/test-user and verification status before public rollout; development/testing authorization may have shorter refresh-token lifetime. Do not promise a persistent production connection until the actual account grant and refresh behavior have been verified. No unrelated audience/publication or security settings were changed.

## Reliability and validation

- A message deleted after the mailbox list is fetched is skipped during metadata retrieval; it no longer fails the remaining page. List/detail failures, denied permissions and rate limits still propagate safely.
- Refresh reloads status before messages, resets page tokens/selection and clears stale connection errors after recovery. Aborted/older responses cannot overwrite the current page.
- Backend suite: **181 passed**, including **54** Gmail/auth/OAuth/bootstrap/vault checks and the isolated route test.
- Frontend suite: **55 passed**; affected-file ESLint and the production build pass.
- In-memory frontend checks cover folders, search, detail, pagination, status-first refresh, cancellation, timeout/handoff handling and zero Gmail requests in preview mode.
- Live OAuth/mailbox reading is pending publication, private server configuration and the administrator's consent. Tests use synthetic credentials/providers; no emails were read or sent during development.

## Files

Backend: `.env.example`, `server.js`, `models/GmailConnection.js`, `models/GmailOAuthNonce.js`, `routes/gmailRoutes.js`, `services/gmailService.js`, `utils/gmailOAuth.js`, `tests/gmail.test.js`.

Frontend: `package.json`, `src/App.jsx`, `src/admin/components/common/Sidebar.jsx`, `src/admin/components/common/Topbar.jsx`, `src/admin/pages/Integrations.jsx`, `src/admin/pages/Settings.jsx`, `src/admin/pages/integrations.css`, `src/admin/pages/GmailInbox.jsx`, `src/admin/components/integrations/GmailConnectionCard.jsx`, `src/admin/components/integrations/gmailApi.js`.

Documentation: `docs/GMAIL_INTEGRATION.md`. No dependencies, lockfiles, authentication modules, existing business records or WhatsApp files change.

Primary references: [Gmail API setup](https://developers.google.com/workspace/gmail/api/quickstart/nodejs), [Gmail scope definitions](https://developers.google.com/workspace/gmail/api/auth/scopes), [Google server OAuth and offline access](https://developers.google.com/identity/protocols/oauth2/web-server#offline).
