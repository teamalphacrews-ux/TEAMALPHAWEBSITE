# Studio settings, Gmail and personalized overview

This feature branch builds on the unmerged modern-interface PR #6. Publication remains paused; neither branch should be merged into the production release branch until the user resumes publishing.

## Overview and appearance

The reference-inspired workspace uses a soft gray Daylight canvas, rounded white cards, pill navigation, thin icons, green/orange ambient feature cards and dotted numerical headings. Booking momentum and production metrics use existing studio records; no artificial growth or trends are presented. Neutral charcoal-gray Dark mode covers the workspace shell, business modules, form controls and dialogs. Authored client document previews retain their saved colors and typography.

Customize offers eleven cards: open enquiries, booked projects, upcoming events, pending tasks, booking momentum, production pulse, upcoming schedule, action queue, enquiry pipeline, recent enquiries and quick access. Each can be hidden or restored; Reset to default restores all cards without changing the selected theme. An empty dashboard is supported. Keyboard focus, touch targets, responsive stacking and reduced-motion preferences are supported.

Saved administrators have their own `User.studioPreferences`, served by authenticated GET/PATCH `/api/studio/preferences`. The client uses a per-account device cache, serializes saves and offers a retry if account sync fails. Sample preview accounts use device preferences only. Public pages do not receive the admin theme.

## Settings and integration behavior

- Studio profile: legal name, GSTIN format validation, studio name/address, persistent JPEG/PNG/WebP brand image upload (maximum 2 MB), document logo defaults, WhatsApp Business contact link, Instagram and Facebook links.
- Billing/documents: prefixes, optional atomic sequential references and financial year, default tax/discount, due dates, payment milestones, bank and UPI instructions. Accepted quote amounts and existing document numbers are preserved.
- Automation: new-document reminder defaults, required studio invoice review, in-app acceptance/payment/assignment/deadline notifications and one daily in-app briefing. Scheduled jobs deduplicate notifications. Client email delivery still requires the existing SMTP transport.
- Communication: outgoing sender/reply-to and document message defaults, support hours, delivery readiness and a rate-limited test to the signed-in administrator's own email address. Read-only Gmail and outgoing SMTP delivery are separate connections.
- Production: multiple reusable checklists, optional default on new bookings, explicit Apply template on existing production projects. Reapplying preserves existing task progress. If a booking saves but a checklist operation fails, the studio can apply its saved template from Post production; booking and task creation are separate database operations.
- Client experience: saved visibility for crew, progress, approved deliverable links, issued invoices/payment schedules and chat; link expiry, revoke and regenerate controls. Visibility is enforced in the public API as well as the UI. Invoice schedules remain unavailable until the studio issues the draft.
- Security/access: owner-only policy editing; server-enforced discount, deletion, export and invoice-issue permissions; idle/absolute session limits; signed-in devices and session revocation. Existing admin tokens require a fresh sign-in after deploying this session model. Internal staff accounts are managed by the configured studio owner.
- Backups/recovery: owner-only encrypted business-record snapshots, daily/weekly scheduling, bounded retention, JSON download and transactional restore of missing records. Restore never overwrites current records. Recoverable record deletion covers the primary enquiry, task, crew, finance, calendar and document workflows; linked enquiries remain archived. Protected Drive galleries, Google Sheets and actual file deletion are outside the record recovery bin.

Snapshots are stored in the same MongoDB deployment, rather than a separate disaster-recovery service. They exclude credentials, OAuth/session/vault data and media file bytes. Restore requires MongoDB transaction support, as provided by Atlas, and the original stable encryption key. Restored document links must be shared again; reminder and scheduled delivery automation is disabled for restored documents. External provider changes, such as Google event deletion, cannot be rolled back by a local record restore.

## Gmail configuration before use

1. Enable Gmail API in the studio's Google Cloud project.
2. Add the backend's exact `/api/integrations/gmail/callback` URL to the OAuth client's authorized redirect URIs. Keep the existing Calendar redirect.
3. Configure `GMAIL_REDIRECT_URI` on the backend. It uses existing `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`, or an optional complete pair `GMAIL_CLIENT_ID` / `GMAIL_CLIENT_SECRET`.
4. Keep `FRONTEND_URL` and `VAULT_SECRET` configured. Optionally set `API_PUBLIC_URL` to the canonical backend HTTPS origin for uploaded document logos. `BACKUP_SECRET` may isolate backup encryption; otherwise the vault key is used.
5. Each administrator connects and approves their own Gmail account through Integrations or Email. No Google authorization is performed by this code change.

The only mailbox scope is `gmail.readonly`. Gmail lists Inbox, Sent and All Mail, supports search and next/previous pages, and displays plain-text messages with attachment metadata and an Open in Gmail link. It does not send, delete, mark read or persist message bodies. OAuth state is single-use, browser-bound and uses PKCE; encrypted tokens are bound to the saved administrator. Disconnecting Gmail preserves Calendar.

Google classifies Gmail read-only access as a restricted scope. The production consent/verification requirements depend on the Google project's audience and usage; external apps in Testing can require reconnection after refresh-token expiry. See [Google's Gmail scope documentation](https://developers.google.com/workspace/gmail/api/auth/scopes) and [OAuth token expiration](https://developers.google.com/identity/protocols/oauth2#expiration). Private configuration values must stay in backend hosting settings.

## Validation and preview limits

Automated coverage includes settings validation, numbering concurrency, quote/invoice inheritance, client-link privacy, production template reapplication, notifications, per-account appearance preferences, session/owner permissions, encrypted recovery, Gmail OAuth/token isolation, profile-image upload authorization and email-test recipient/cooldown isolation. No real email was sent by tests.

Local validation on 24 October 2026: 215 backend tests and 57 frontend tests passed; the production frontend build passed (3,453 modules). Studio/public/mobile ESLint and `git diff --check` were checked. No Lighthouse score or real-device performance result is claimed for this authenticated workspace.

Browser review uses the existing local sample preview. Overview card hide/restore/reset, persistence across reload, Daylight/Dark switching, responsive stacking, Finance, Calendar, Settings and dialogs have been reviewed there. The sample backend does not implement live Gmail or backup/security connections, so their actual production account/database flows require verification after a separately approved deployment and private configuration. No production credentials, user data or connected Calendar records were changed during this work.

The detailed changed-file list is in `STUDIO_SETTINGS_FILES.md`.
