# Studio OS interface refinement audit

Reviewed on 24 October 2026 on `feature/studio-settings-integrations`. This continues PR #7, which depends on the unmerged PR #6. Production publishing remains paused.

## Changes

- Aligned document editors, contacts, projects, operations, finance, calendar, support, activity, team management, integrations and Settings with the personalized overview's typography, rounded controls, spacing and Daylight/charcoal surfaces.
- Corrected dark editor surfaces and low-contrast tabs, avatars, status badges and light-mode metadata. Authored invoice/quotation previews retain their document colors and fonts.
- Contained wide Enquiries, Contacts, Crew and Post-production tables within their own horizontal scrolling panels. Layout containment prevents their intrinsic widths from extending the whole mobile page. Touch scrolling remains available inside each table.
- Reused one keyboard-accessible action menu: arrow navigation, Home/End, Escape, outside dismissal and focus return. Unsaved invoices no longer offer delivery history, link revocation, cancellation or deletion before those actions apply. Link controls refresh after sharing or revocation.
- Improved dialog focus containment, unique accessible labels, busy controls, required-field validation, filtered empty states, retry messages and refresh behavior. Calendar deletion now surfaces a Google synchronization warning returned by the server.
- Rebuilt Team & access and Studio activity using the shared workspace controls. Team changes remain owner-gated; an ordinary name edit does not resubmit the saved password or revoke sessions. Sample accounts cannot mutate real account access.
- Added unsaved Settings feedback and browser-close protection; connection errors do not appear as successful configuration. Gmail detail failures can be retried. Read-only Gmail remains separate from Calendar and outgoing email.
- Improved workspace-search keyboard navigation, notification focus return and bounded internal destinations. Support conversation selection follows its URL and isolates reply drafts/retry IDs to the selected client.

## Browser coverage

Used the existing local sample backend, with a desktop viewport of 1280 × 720 and a phone viewport of 375 × 812. Responsive overrides were reset after review. Main pages reviewed:

| Area | Routes |
| --- | --- |
| Overview and relationships | `/admin`, `/admin/crm`, `/admin/contacts`, `/admin/studio-projects` |
| Documents and finance | `/admin/quotations`, `/admin/templates`, `/admin/invoices/new`, `/admin/finance` |
| Operations | `/admin/calendar`, `/admin/projects`, `/admin/crew`, `/admin/post-production`, `/admin/data` |
| Studio | `/admin/chats`, `/admin/activity-log`, `/admin/users`, `/admin/settings`, `/admin/integrations`, `/admin/email` |

All nineteen pages loaded in the phone review without an application alert or page-width overflow after the fixes. Wide data tables keep their own scroll area. Desktop and phone reviews covered Daylight and charcoal Dark appearances, with focused rechecks of changed surfaces. Contact/project detail and document action menus, representative calendar/finance forms, search keyboard navigation, Escape dismissal and invoice action availability were also reviewed. Existing overview card hide/restore/reset and reload persistence checks remain recorded in the settings delivery notes.

Visible text contrast was spot-checked from computed foreground/background colors; failures found in tabs, badges, avatars and document metadata were corrected. This is not a formal accessibility certification, Lighthouse audit or physical-device test. Reduced-motion handling remains enabled.

## Follow-up: project dialogs and fluid feature cards

The user's subsequent screenshot exposed a gap in the page-route review: project/enquiry dialogs are portalled outside the main workspace, so several theme selectors did not reach their inputs, facts, badges or active tabs. Those shared selectors now include the portal root. Hard-coded purple detail text and pale borders were replaced with semantic tokens; inputs, amounts, avatars and metadata match the selected appearance. The dialog body has its own bounded scroll area with a stable scrollbar and scroll padding. Phone headers use compact, labeled edit/close controls instead of wrapping onto a second toolbar row.

The reproduced Riya & Karthik dialog was reviewed at 1280px and 375px, including Overview, Tasks, Delivery and the nested Edit details form, in charcoal Dark and Daylight. Dark inputs no longer have white backgrounds; phone dialogs remain within the viewport. No form was submitted during this review.

Booking momentum and Production pulse contain overlapping radial and masked conic light layers. A follow-up visibility check found the original animation was running but blended too softly into the base gradient. The light now sits explicitly above the base background and below the content, with a clearer six/seven-second flow, stronger color separation and a static center wash to keep text readable. Two browser observations confirmed that the visible layers moved between frames. Only transform animation is used; there are no video assets, new libraries, cursor listeners or animated blur filters. An IntersectionObserver and page-visibility listener pause the layers when offscreen or the tab is hidden. Offscreen animation pause was verified in the browser. Phones use two layers per card, and prefers-reduced-motion disables the animation completely. The overview figures remain real studio metrics.

## Automated validation

- 57 frontend tests passed.
- 215 backend tests passed.
- Studio, public and mobile ESLint passed, including the rewritten Activity page.
- Production frontend build passed (3,455 modules).
- `git diff --check` passed.

The current refinement changes only frontend code and documentation. The backend tests cover the existing feature branch's settings, Gmail, authorization, recovery, document and workflow behavior.

## Limits and local preview

Local preview is available over Wi-Fi at `http://192.168.29.248:5173/admin` while the local processes run. Vite binds to the LAN interface and proxies API requests to the existing preview backend on loopback; no browser API URL points phone users at their own `localhost`.

This is explicitly labeled sample data. The preview fixture does not implement real Gmail, SMTP, security/session or Atlas recovery connections. External account authorization, actual email delivery and database restoration were not exercised. No production records, connected Google events, contracts, invoices, payments or client messages were changed during browser review. Production verification requires a separately approved deployment and the configuration described in `STUDIO_SETTINGS_AND_APPEARANCE.md`.
