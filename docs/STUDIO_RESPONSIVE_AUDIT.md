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
