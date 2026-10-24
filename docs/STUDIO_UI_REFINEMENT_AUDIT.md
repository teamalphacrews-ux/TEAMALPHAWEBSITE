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

All three feature cards now use solid system-sans figures with tabular numerals; the dotted text mask has been removed. Booking momentum has flowing diagonal aurora ribbons; Production pulse has counter-rotating masked halos and a light wash. Finance pulse retains its fluid glow and travelling liquid wave. The decorative layers sit explicitly above the card background and below readable text and controls. Two browser observations confirmed changing transforms. Only transform animation is used; there are no video assets, new libraries, cursor listeners or animated blur filters. An IntersectionObserver and page-visibility listener pause the layers when the feature grid is offscreen or the tab is hidden. Phones use two light layers per card, and prefers-reduced-motion disables the animation completely. Desktop and phone reviews covered both appearances; the three cards stack without page overflow at 375px.

## Finance overview card

Finance pulse uses the existing authenticated finance endpoint, extended to project invoice status, currency, due dates and payment schedules. Today/overdue INR balances form Due amount; future and undated balances form Upcoming amount. Draft, cancelled, archived and paid invoices are excluded from outstanding collections. Advances are allocated to the earliest valid scheduled instalments. Invalid legacy schedules fall back to the invoice deadline. Net profit is received ledger income minus paid ledger expenses, supports a loss and never counts invoice deposits a second time. The card states its all-time cash basis and excluded foreign-currency invoice count. Errors display dashes and Retry. It refreshes every minute while the document is visible.

Personalization includes the twelfth card. A versioned migration adds it once to existing nonempty layouts, preserving intentionally empty dashboards and later opt-outs. Hide, reload persistence and restore were checked in the sample preview. A browser geometry check caught a specificity conflict collapsing the Finance wave container; its motion-layer class now keeps the wave absolutely positioned at full card width. The visible wave and changing translation were verified after the fix.

## Follow-up: empty states and switches

The Booked and Completed Projects filters exposed a hard-coded white empty-state background. The shared relationship empty state now uses the selected surface, text and border tokens, with rounded edges. Filtered empty states name the selected stage and offer View all projects. Both themes and a 375px viewport were checked. The reported Riya & Karthik dialog was reopened in the current preview; facts, payment amounts, badges and inputs remained readable and the cards no longer intersected the header.

Settings, Quotation and Invoice switches now share a 46 × 26px track, contrasting thumb, explicit On/Off text and at least a 44px-high input target. On uses a green track; Off uses gray. Dark mode adjusts both thumb and track instead of allowing a white thumb to disappear against a white checked track. Native keyboard behavior, switch semantics, disabled states and focus outlines remain available. A Settings switch was toggled with Space and restored without saving; checked quotation switches and unchecked invoice switches were inspected without altering documents. Phone Settings spacing was reviewed in Daylight.

The invoice editor also retained an obsolete negative margin after focus-mode padding was removed. Its margin is now zero and focus-mode padding is consistent. Browser geometry confirmed a 0px left edge and no page overflow at 1280px, 820px and 375px. No invoice was saved or issued during this review.

## Automated validation

- 62 frontend tests passed.
- 216 backend tests passed.
- Studio, public and mobile ESLint passed, including the rewritten Activity page.
- Latest production frontend build passed (3,460 modules).
- `git diff --check` passed.

The latest Finance addition extends the existing backend invoice projection and appearance-preference schema/validation; it adds no endpoint or financial mutation. The backend tests also cover the feature branch's settings, Gmail, authorization, recovery, document and workflow behavior.

## Limits and local preview

The subsequent six-viewport review (114 route snapshots), shared alignment fixes, tablet navigation, compact phone calendar and quotation register redesign are documented in `STUDIO_RESPONSIVE_AUDIT.md`.

Local preview is available on this computer at `http://127.0.0.1:5173/admin`. The earlier Wi-Fi address `192.168.29.62` became unreachable during the final handoff; verify the current address before opening the preview on another device. Vite binds to the LAN interface and proxies API requests to the existing preview backend on loopback; no browser API URL points phone users at their own `localhost`.

This is explicitly labeled sample data. The preview fixture does not implement real Gmail, SMTP, security/session or Atlas recovery connections. External account authorization, actual email delivery and database restoration were not exercised. No production records, connected Google events, contracts, invoices, payments or client messages were changed during browser review. Production verification requires a separately approved deployment and the configuration described in `STUDIO_SETTINGS_AND_APPEARANCE.md`.
