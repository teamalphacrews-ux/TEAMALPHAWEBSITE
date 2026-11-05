# Studio OS live repair review

Candidate branch: `fix/live-studio-mobile-workflows`, based on deployed personal release `72dc4032a4b5112de69f2deeebb2b441981d5f1f`. This repair does not import the separate development tree's unfinished SaaS or iOS changes. No production records, passwords, account roles, Google grants or email recipients were changed during testing.

## Implemented

- Enable the bottom More grid for iPhone Safari, as requested, while preserving iPad and desktop navigation.
- Repair crew email/phone field alignment, compact roster rows, Shoot Day date controls and calendar action spacing.
- Match the studio browser canvas and Safari theme-color hint to Daylight or Dark gray, restoring the public site's previous values on exit. Browser and iOS settings retain final control over browser chrome.
- Preserve date-only all-day Google events through storage, sync, editing and display. Existing imported Google all-day records are repaired during the next authorized sync without overwriting newer local titles or crew assignments.
- Add a prominent quotation client-link action independent of email delivery. Return and validate canonical public links from the backend before changing document sharing state. Retain token expiry, revocation and client visibility controls.
- Refine mobile quotation rows, headers, item tools, design dialogs and quote/invoice email composition in both themes. Email samples retain a readable paper palette.
- Keep a newly enabled default installment schedule responsive to later price entry, while preserving customized schedules and server validation.
- Explain missing outgoing-email setup before sending. Email sending and scheduling remain disabled when the server has no delivery provider; sharing a client link remains available.
- Add safe Gmail setup diagnostics and reconnect states. Diagnostics expose readiness only, never credential values. Gmail remains read-only and separate from outgoing studio email.
- Verify saved admin sessions on startup and handle expired sessions without deleting recoverable drafts. Public quote/invoice links remain open when an unrelated administrator session expires. Preserve drafts across passive cross-tab session expiry and same-account reauthentication; explicit logout and verified account switches retain draft cleanup.
- Retain owner-only team-access controls and make the restriction understandable. Validate team names, passwords and normalized unique email addresses; single-word names are supported.

## Production setup still required

1. Review and publish this candidate before expecting these repairs on the live website. No production deployment is part of this review.
2. Outgoing sender requested by the owner: `teamalphacrews@gmail.com`. Configure its delivery credentials privately in Render. The current backend has no SMTP or Gmail SMTP credentials. Do not place credentials in chat, source control or frontend settings. No email delivery is claimed until a real configured send is tested with the owner's chosen recipient.
3. Gmail: configure `GMAIL_REDIRECT_URI=https://team-alpha-api.onrender.com/api/integrations/gmail/callback` on the backend and register that exact callback on the existing Google OAuth client. Enable the Gmail API, keep the existing vault key unchanged, then complete the account's Gmail consent flow. No additional Google scope was granted during this repair.
4. Google Calendar has an invalid/revoked grant and needs the account holder to reconnect from Calendar. Successful consent and a subsequent sync are required to verify live calendar access.
5. The screenshot's second administrator cannot manage team access by design. Sign in with the configured studio owner's account (`teamalphacrews@gmail.com`) to add or change administrator access. This repair does not broaden permissions or reset credentials.

## Validation and limits

375 backend tests and 214 frontend tests passed, along with Studio/public/mobile ESLint checks, production frontend build and whitespace validation. Regression coverage includes session expiry/draft preservation and public-link continuity, owner restrictions, team record validation, canonical sharing without SMTP, token formats/privacy, Gmail readiness, date-only calendar semantics and enabling installments before price entry.

Visual and workflow checks use an isolated local server with disposable in-memory records and candidate backend code, with no production database or mail credentials. Layouts were inspected at approximately 393, 820, 1280 and 1920 CSS pixels. Key checks include More navigation, dark-mode crew fields and calendar forms, quotation composition and no horizontal page overflow. Browser testing passed quote acceptance, automatic draft invoice creation, studio approval/issue, and the original client link showing the issued invoice, two installments and bank/UPI instructions. A new invoice enabled at zero value also recalculated its saved 30/40/30 default installments after price entry and saved successfully. No payment app was opened and no money or email was sent. The local preview is browser testing, not a certification of real iOS keyboard, Safari toolbar or native-device behavior. A real-iPhone retest after publication is still required.

Screenshot export was denied by the local tool sandbox; inline preview captures were used for review. No saved screenshot artifact or full live email/Google integration test is claimed.
