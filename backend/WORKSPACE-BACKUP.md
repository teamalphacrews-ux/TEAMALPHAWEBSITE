# Personal Studio OS workspace recovery

Settings → Backups & recovery provides encrypted full-workspace archives, file
restore, Google Drive storage, and a password-confirmed master reset. These APIs
are limited to the saved, active personal studio owner with full module access.
They do not operate on commercial SaaS workspaces or its billing registry.

## Setup

- Use MongoDB Atlas or another replica set supporting transactions. Standalone
  MongoDB cannot run archive creation, reset or replacement restore.
- Keep the existing `VAULT_SECRET` stable. Optionally configure a separate stable
  `BACKUP_SECRET` of at least 32 characters before creating archives. Keep its
  original value in private disaster-recovery storage. It is not exported and
  cannot be recovered from an archive. Changing the key makes old archives
  unreadable. Never put these values in frontend variables or source control.
- Google Drive requires the Drive API, the configured OAuth consent screen and
  an exact backend callback ending `/api/integrations/drive-backups/callback`.
  Set `DRIVE_BACKUP_REDIRECT_URI` to that public HTTPS address and `FRONTEND_URL`
  to the public HTTPS website origin. Dedicated `DRIVE_BACKUP_CLIENT_ID` and
  `DRIVE_BACKUP_CLIENT_SECRET` must be supplied together; otherwise the existing
  Google OAuth client is reused with a separate grant and callback.
- Drive requests `drive.file` and verified email identity only. The owner connects
  explicitly. Only archives tagged for that owner and created by this integration
  can be listed, uploaded or downloaded. Calendar and Gmail grants are separate.
- iCloud Drive uses the device Files picker or a manual move of the downloaded
  encrypted file. There is no direct iCloud API sync and no Apple credentials
  are collected. Browser downloads may need to be moved to iCloud manually.

## Coverage and limits

The version 2 archive covers 29 allowlisted collections: company settings,
contacts, enquiries, projects, quotations and templates, invoices, payments and
ledger records, crew, calendar, tasks, galleries and media metadata, messages,
notifications, document counters and team account metadata/permissions. Stored
receipt and profile-image bytes are included. The codec's `COVERAGE` describes
the complete inventory and exclusions returned by the API.

Passwords, password hashes, active sessions, provider/API credentials, push
tokens and live sharing capabilities are excluded. External photo/video originals
and repository/static assets remain references only. Local files under
`backend/uploads` are not bundled; their presence blocks reset and replacement
restore until an operator has handled their backup. The application does not
delete external Drive, Cloudinary or iCloud content.

Limits: 10,000 records, 32 MiB plaintext, 48 MiB encrypted upload, bounded 1 MiB
database chunks. Archives are AES-256-GCM authenticated with a fresh nonce.
Manual archives expire from server history after 30 days; pre-reset/pre-restore
safety archives expire after 90 days. Downloaded or cloud copies are not expired
by the server. Existing legacy records-only snapshots remain separate and cannot
be imported as a full-workspace replacement.

## Reset and restore behavior

Master reset, replacement restore and post-recovery integration resume are
disabled by default. They require the explicit backend setting
`WORKSPACE_RECOVERY_ENABLED=true` after the release checks below pass. Missing,
false or other values leave these service operations blocked, even for the
owner. Encrypted archive creation, download and inspection remain available.

The owner must enter the current password, acknowledge the warning and type
`DELETE WORKSPACE DATA` or `RESTORE WORKSPACE`. The backend independently checks
the saved owner and active session. Before any deletion it creates an encrypted
safety archive in the same transaction as all replacement writes. Any failure
rolls back the complete operation. No partial reset is supported.

The current owner sign-in and recovery archives are retained. Other team accounts
are removed on reset and restored disabled on import; the owner must set fresh
passwords in Team & access to reactivate them. Historical references to deleted
accounts become disabled placeholders. Legitimate links to previously deleted
business records are preserved in an authenticated unresolved-reference manifest
and surfaced for review, rather than fabricating business records.

Other sessions and provider credentials are cleared; public client links must be
deliberately reissued. Imported scheduled deliveries are cancelled/inactive and
document reminders are off. Integrations remain paused until the owner reviews
settings, confirms `RESUME INTEGRATIONS` with the password, and reconnects
providers where required. External inbound webhooks return 503 while paused.
Local drafts/preferences use a workspace data epoch so old device drafts cannot
silently repopulate a reset workspace after signing back in.

A cross-process maintenance gate excludes ordinary writes during replacement.
Expired or uncertain reader leases block destructive maintenance permanently
until the offline operator procedure in `WORKSPACE-MAINTENANCE.md` is completed.
Never clear the state while an old process or database operation can still run.

## Verification and release gate

Automated tests cover authenticated archive round trips, malformed input,
credential exclusion, owner authentication, disabled imported accounts,
transaction rollback, binary attachments, historical references, concurrency
leases, write middleware, epoch cleanup and OAuth cookie/PKCE replay prevention.
Provider calls are stubbed; no real Google upload or production reset is performed
by these tests. UI validation uses disposable sample records, with destructive
requests blocked in the local screenshot fixture.

Before enabling destructive recovery in production, run a reset and restore
round trip against a disposable replica-set database, including a second backend
process/worker, verify receipt/profile images and totals, and reconnect Google
Drive with a test account. The local environment used for this change has no
MongoDB replica-set binary; real transaction/provider validation remains a
release dependency. No live data was reset or restored during development.
Keep `WORKSPACE_RECOVERY_ENABLED` unset or false while that dependency is open;
the live interface shows the release block and disables reset and restore.
