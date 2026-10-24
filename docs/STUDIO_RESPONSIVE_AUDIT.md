# Studio OS responsive layout audit

Reviewed locally on 24–25 October 2026 on `feature/studio-settings-integrations`, continuing PR #7. Production publication remains paused.

## Layout changes

- Shared fluid page gutters and a centered 1,700px content limit align headers, toolbars and content on wide displays. Document focus mode keeps its full-width editor canvas.
- Tablet portrait uses the existing accessible navigation drawer, preserving workspace width rather than squeezing it beside a fixed sidebar. Escape returns focus to the menu button.
- Search fields and adjacent filters share a 44px control height. Headings and actions wrap together; phone input text is at least 16px in the shared controls.
- Overview feature cards use two columns where three would become cramped; the third card spans the row. Phones use one column. At 768px the first two cards measure approximately 356px each.
- Currency and status summary values use a smaller responsive type scale while numeric counts retain their hierarchy.
- The phone Month calendar fits all seven days without horizontal scrolling. Each date is a full-cell button with event indicators and an accessible event count. Selecting a date shows full event buttons underneath; those buttons open the existing event details. Month paging selects the first day of the new month. Desktop event chips and Agenda remain available.
- Quotations has a separate page heading, search field, record count, wrapping status filters, aligned register columns and clear status colors. At narrow container widths each quote becomes a labeled card. Phones use a native status selector. Existing quote title/open actions, templates and new-quote flow are reused; no document API changed.
- Quotations distinguishes a genuinely empty list from a filtered result, supplies Reset filters and keeps loading/error/retry states explicit.

## Browser matrix

The following viewport sizes were tested in the in-app browser using the existing local sample backend. These are emulated dimensions, not physical-device certifications.

| Viewport | Layout represented | Main route checks | Month calendar width / scroll width |
| --- | --- | --- | --- |
| 375 × 812 | Phone | 19 | 303 / 303px |
| 768 × 1024 | Small tablet portrait | 19 | 691 / 691px |
| 1024 × 1366 | Large tablet portrait | 19 | 927 / 927px |
| 1366 × 768 | Laptop | 19 | 1,004 / 1,004px |
| 2560 × 1440 | Desktop | 19 | 1,580 / 1,580px |
| 3440 × 1440 | Ultrawide desktop | 19 | 1,580 / 1,580px |

The 114 route snapshots cover Overview, Enquiries, Contacts, client Projects, Quotations, Templates, new Invoice, Finance, Calendar, production Projects, Crew, Post production, Data, Support, Activity, Team, Settings, Integrations and Email. Each page loaded without an application alert or document-width overflow. Geometry checks exclude intentional table/scroll containers; wide operational data tables still scroll inside their own panels.

Focused follow-up checks after the final calendar and quotation changes covered all six widths. Quotation search, mobile Open filter, desktop Draft filter, reset after an empty search, opening an existing quote and entering/returning from the new-quote chooser worked. Desktop and phone quotation surfaces were visually inspected in Daylight and charcoal Dark; the prior Daylight choice was restored. The quote register remained within the viewport at every size.

Additional checks covered the 768px feature-card boundary, 1024px navigation drawer and Escape focus return, month paging/Today, selecting an event date on the phone and opening its existing detail, and phone/tablet event forms. The phone event form measured 355 × 788px within 375 × 812px; sampled inputs used 16px text and at least 44px control heights. Forms were closed without saving. On the 3440px display the topbar content and main content shared the same 1,030px left alignment.

## Validation and limits

The final frontend build passed with 3,460 transformed modules. All 62 frontend tests passed, alongside Studio/public/mobile ESLint and `git diff --check`. The backend is unchanged in this follow-up; the branch's prior 216 backend tests passed and CI reruns them.

No invoice was saved or issued, quotation sent or accepted, Calendar synchronization invoked, client message sent, or production record modified during this review. Real Gmail/SMTP/Google account authorization and Atlas recovery cannot be exercised by the sample backend. No Lighthouse score, physical Safari/iPad gesture result or production performance measurement is claimed. Saved screenshot export was unavailable in this session; visual checks used inline browser screenshots.

Local preview: `http://127.0.0.1:5173/admin/quotations`. The earlier Wi-Fi address `192.168.29.62` became unreachable during the final handoff; recheck the current network address before using it from another device. Configuration and deployment limits remain in `STUDIO_SETTINGS_AND_APPEARANCE.md`.


## Follow-up: workflow priorities and feature-card placement — 25 October

The user's later direction keeps Booking momentum, Production pulse and Finance pulse above Upcoming Events. This supersedes the earlier suggestion to put urgent work before every feature card. The default board now places those three compact cards first, then Today/upcoming events and the deadline-ordered Action queue, followed by the four summary metrics and remaining workspace cards. Production pulse emphasizes active crew rather than repeating the pending-task headline.

All twelve cards participate in one ordered DOM grid. Arrange cards provides keyboard-accessible Up/Down controls, preserves a hidden card's position, and saves cardOrder separately from visibleCards. Account storage validates a complete known-card permutation. Legacy accounts receive the new default order; Reset to default restores both order and visibility while retaining the theme. iPhone-style switches retain 44px input targets and native keyboard behavior.

Dashboard enquiry/event links now carry record identity and a safe internal return path. The selected enquiry opens after data loads; closing a dashboard enquiry returns to Overview. Browser Back from an enquiry selected in its own list closes the dialog. Calendar event links select the actual event month/day, open its details and retain a Back link.

Contacts and client Projects replace their wide tables with compact phone cards showing name, date, type/status and explicit Open actions. A browser check found and corrected a specificity conflict that initially left the desktop table visible under those cards. Desktop tables remain in place above 760px.

Quotation lifecycle wording is shared across Quotations, contact/project Documents and enquiry quote links. Sent proposals display Open, terminal states are retained, and expiry uses the existing backend's end-of-day IST boundary. Email delivery states remain separate. Enquiry links without validity metadata use neutral View quote wording rather than guessing whether a sent proposal has expired.

Finance has a focused Due now view at /admin/finance?view=due. The overview Due amount and Finance total link to it. Issued unpaid INR balances due today or earlier are sorted by the earliest unpaid deadline, with due-now amount, outstanding balance, overdue days and Open invoice actions. Confirmed advances apply oldest-first; valid schedules are allocated in paise, and malformed schedules fall back to the invoice deadline. The same helper supplies the overview totals. Mobile rows use one semantic table presented as compact cards.

The page-only search now says Find a page and No matching pages. Grouped contact/project/quote search remains future work, as distinguished in the user's priority list.

Calendar More events opens only the selected day's agenda with Show whole month to return. Calendar, event editing, Crew, Finance and Overview use the configured studio timezone. Shared calendar math handles exclusive midnight event ends and daylight-saving boundaries. Date formatters and day-boundary caches are bounded (32 timezone/formatter entries and 256 days). Untouched calendar dates follow settings hydration; new contact-session forms wait for it, and each editing session retains its timezone without resetting typed values. The dashboard API's overdue count now uses the start of the studio day rather than the viewing device's current time, so a task due today is not already overdue.

### Follow-up verification

- Rechecked eight changed views across 375, 768, 1024, 1366, 2560 and 3440px: 48 route snapshots, each without document-width overflow or an application alert. Intentional wide operational tables retain internal scrolling.
- Rechecked the phone Overview, Contacts, Projects, Quotations, Calendar and Due now views in Daylight. The original Dark appearance was restored.
- Verified Up/Down changes actual card order, persists after reload, and retains position through hide/restore. The original visible-card selection and requested feature-first order were restored.
- Verified direct enquiry opening, return to Overview, enquiry-list browser Back, selected Calendar event opening and its Back link, mobile Open project, and matching Open quotation wording in project Documents.
- Finance's focused empty state and navigation were reviewed. The local preview has no issued due invoices, so populated desktop/mobile payment rows were not visually exercised. Allocation, sorting, deadlines, exclusions and precision have fixture-based tests.
- The crowded-day More events branch has source/helper coverage; the sample calendar has fewer than four events on any one day. No event was created solely to populate it.
- No task was completed, invoice saved/issued, quote sent/accepted, Google sync invoked, or client message sent during these checks. Preview appearance/card preferences were the only saved UI state.
- Final validation: 83 frontend tests, 220 backend tests, Studio/public/mobile ESLint, production frontend build (3,470 modules) and git diff --check passed. These checks do not claim physical-device certification or Lighthouse performance scores.

The local network preview was restarted at http://192.168.29.248:5173/admin with the existing sample-data backend. Production publishing remains paused.
