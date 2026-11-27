# Studio X OS responsive audit

- **Review branch** `review/studio-x-os-responsive-audit`
- **Baseline** `2cd940d` from the first-login setup checkout
- **Review environment** Isolated Studio X OS sample workspace and a disposable local API and MongoDB replica set with synthetic records

## Implemented fixes

| Surface | Reproduced issue | Change |
| --- | --- | --- |
| Workspace navigation | Between 761 and 768 CSS px, the fixed dock could cover keyboard-focused controls. Safari tablet navigation could also lose focus after Escape. | The dock and its scroll area share one breakpoint. Wider browser widths use the tablet drawer and its trigger receives focus when the drawer closes. The drawer reports its expanded state. |
| Notifications | On short phone and desktop viewports with six long updates, text ran past card edges and the footer fell below the viewport. | The panel fits the viewport, its list can scroll independently, long references wrap, and the footer remains reachable. |
| Workspace loading | The lazy route loader used low-contrast lavender text on the light workspace canvas. | The loader inherits text and focus colors from the active theme. Its status remains visible with reduced motion enabled. |
| Calendar | Short and overlapping week bookings rendered as tiny tap targets with clipped labels. | Compact week layouts use dated agenda rows. Desktop retains the timetable and includes full-size actions below it for short or overlapping events. |
| Records | Unbroken company names introduced a horizontal scrollbar in tablet Contacts. Project scheduling controls squeezed on narrow phones. | Long company names wrap and compact action groups can reflow. |
| Finance and public documents | Long labels and references forced horizontal overflow. Narrow invoices hid quantities, prices, amounts, due dates or statuses. Duplicate quote links added extra keyboard stops. | Compact invoice rows preserve the fields with visible labels. Quote links offer one tab stop per row, document colors use stronger foreground contrast, and ledger scrolling supports keyboard focus. |
| Invoice download | A newly created studio’s default SVG logo prevented invoice PDF export in Chromium and WebKit. | PDF export handles SVG and raster logos. Missing logo files leave the invoice downloadable. |
| Communication and operations | Mobile Email lost focus between list and message. A long client name displaced the support detail pane. Delivery assignee names overflowed, and the Activity unread dot had invalid accessibility semantics. | Focus follows the email pane and returns to the originating list item. Support and Delivery content wraps in its own column. The decorative unread marker is hidden from assistive technology and a text status remains available. |
| Website, Guides and Smart Link | Phone workbench tabs clipped, long search terms overflowed the Guides status, and long studio or client names strained the Smart Link footer and hero. | The tab strip scrolls within its container, Guide search restores focus and wraps long feedback, and the Smart Link handles long content and bright hero images. |
| Account forms | Password help was detached from the field for assistive technology. Form errors appeared above the form, far from the action on a phone. Two rapid invitation activations sent two requests. | Password instructions are associated with their inputs, submit failures appear beside the relevant action, and invitation acceptance guards against duplicates. |

## Verification scope

The route inventory distinguishes owner fixtures, real owner and team access, public visitors, and holders of a quotation or invoice link. Layout checks use browser viewport simulation. The desktop Chromium and iPhone/iPad WebKit test suites supplement the visual inspection of before-and-after captures. Screen reader operation, physical-device browser chrome and virtual keyboards require separate hardware verification.

The reviewed commercial routes include registered aliases, document links, nested Settings and project tabs, and first-login states. `/portal/*`, `/admin/clients` and commercial gallery routes follow their existing redirects. A separate commercial password recovery route is absent. The standalone legacy client dashboard, chat, cloud and gallery source files are outside the active commercial route tree.

### Browser evidence

- Widths in CSS pixels include 320, 360, 375, 390, 430, 600, 768, 820, 1024, 1280, 1440 and 1920, plus nearby breakpoints and short or landscape viewports.
- The matched keyboard test exercised 849 Tab steps in 21 configurations. The dock obscured focused links on 54 baseline steps at 761–768px and on zero steps after the change. The same scenarios verified action menus, Search, More and tablet navigation dismissal.
- At 320×470, six long synthetic notifications pushed the footer down to y=548. The revised panel keeps the footer at y=443, and the long title and reference fit inside the list. The test also opened the panel on a short desktop and simulated phone landscape.
- Expanded-text simulation combines a 200% root font size and the existing Comfortable preference. It exercises the layout without relying on an OS-level zoom or text-size setting.
- The final build also passed 36 Chromium browser-zoom checks at 100%, 200% and 400% across Guides, project detail, both document editors, Settings and Client Smart Link.
- Manual inspection used the running preview and before-and-after captures, including calendar events, dark navigation, document amounts, and the Smart Link against a bright cover image.
- The compiled application sweep passed 300 route and theme cases with 8,372 viewport observations. A later run on the final changes covered 66 cases and 1,848 observations. The iPhone 13 WebKit simulation passed 28 cases across three layouts. iPad Pro 11 WebKit simulation passed 28 across four layouts. Explicit Smart Link Daylight and Dark selection was exercised separately from the browser color scheme.
- The local API and disposable database covered 86 workflow assertions. The synthetic partially paid invoice retained the exact recorded amount and Indian currency formatting on the client view.

### Workflows and affected roles

| Module | Tested audience | Targeted viewport widths | Appearance | States and actions |
| --- | --- | --- | --- | --- |
| Marketing and Guides | Public visitor | 320–1920px | Public chrome and supported workbench and guide appearance controls | Landing tabs, phone navigation, Guides index and article routes, long search, no results, and focus |
| Sign-in, registration and setup | Visitor, owner, administrator, staff | 320/390/820/1024/1440px and matrix widths | Dark sign-in and both studio setup themes | Config loading and error, signup, invalid invitation, repeated acceptance, setup validation and resume, workspace unlock, owner review and staff waiting |
| Overview and navigation | Owner, restricted role fixtures | 320/390/768/820/1440px and matrix widths | Daylight and Dark | Visible, hidden and reordered cards, row reflow, sidebar sorting and persistence, keyboard menus, Search and notifications |
| Enquiries, Contacts, Projects and Tasks | Owner, administrator, staff | 320/390/820/1440px and matrix widths | Daylight and Dark | Connected real test records, long values, empty and retry, search, edit and reload, task creation and completion, role-appropriate module states and actions |
| Calendar and Shoot day | Owner, role fixtures | 320/820/1024/1440px and matrix widths | Daylight and Dark | Month, week and agenda, overlapping sessions, long titles, keyboard details and landscape layout |
| Quotations, templates, invoices and finance | Owner and capability-link visitor | 320/390/820/1440px and matrix widths | Both workspace themes, both Smart Link appearances and authored invoice styling | Quote drafting and acceptance, linked invoice generation, preview and issuance, long amounts, payment schedule and status, keyboard scrolling and PDF download |
| Crew, delivery, messaging, activity, settings and account | Owner, administrator, staff | 320/390/820/1024/1440px and matrix widths | Daylight and Dark | Crew assignment and removal, Delivery task completion, Gmail detail focus against fixtures, client support layout, saved settings, permissions and provider-disabled states |
| Client Smart Link | Capability-link visitor | 320/390/820/1440px and matrix widths | Explicit Daylight and Dark | Long titles and studio names, bright covers, appearance toggle, documents and accordion navigation, delivery and support interaction states |

### Blocked external verification

| Route or state | Limitation |
| --- | --- |
| `/studio-os/auth/callback` | Google and Apple end-to-end authorization requires provider test accounts. The isolated environment covered the local account flow and unavailable or returned-error states. |
| `/admin/calendar`, `/admin/email`, `/admin/whatsapp`, `/admin/integrations`, `/admin/data` | Actual provider sync, messages, and remote storage use external credentials or produce external effects. Local toggles, permission states and simulated responses were available. |
| `/admin/subscription`, `/invoice/:token`, `/quote/:token` | External payments require a configured test gateway. Document acceptance, invoice issue, display, and PDF download used the disposable workspace. |
| `/admin/gallery/*`, client delivery and album selection | The commercial gallery route redirects to Projects. The local sample has no connected gallery or externally hosted album selections. The project Delivery tab and local Delivery task flow were exercised. |
| Reset/restore and tenant deletion | Destructive actions were limited to interface and existing automated checks. Production operations need explicit authorization. |
| Native wrapper, iPad Safari, virtual keyboard and assistive technology | The environment supplied desktop Chromium and Playwright WebKit device emulation. It lacked `simctl`, a physical iPad or iPhone, and a screen reader test session. Mobile browser chrome, keyboard occlusion and PDF open-and-return on hardware remain unverified. |

## Engineering checks

- 408 frontend tests and 511 backend tests passed. Backend syntax check, commercial Vite build, and personal-variant compatibility build passed.
- Lint passed on the changed JavaScript and JSX. The scoped Studio lint also completed with its existing Calendar hook warning. Repository-wide lint reported the same 202 errors and 15 warnings as the baseline.
- Browser evidence includes the independently authored compiled homepage. Its final 13 production viewport profiles and selected accessibility rules passed.
- Built commercial assets contain 115 JavaScript files and 51 CSS files. Compared with the baseline, their combined gzip size rose by 3,320 bytes across all chunks. The standalone homepage rose by 39 gzip bytes. These are build measurements. Browser latency and runtime performance gains were outside the measured result.
- The frontend is JavaScript and JSX and has no configured TypeScript check.
- The Impeccable launcher was unavailable locally. Verification used the checked-in design context, targeted axe scans and manual visual reviews.

## Regression risks

- WebKit browser emulation cannot establish how the native iOS wrapper and physical Safari handle browser chrome, pinch gestures, the on-screen keyboard, or returning from a PDF preview.
- The calendar week uses its available container width to choose agenda or timetable. The seven-day strip keeps all dates available on one row. At a 360px viewport each date measures about 42 by 80 CSS px. Booking actions maintain at least 44 by 44 CSS px.
- Client invoices preserve the studio’s chosen accent and select readable foreground colors. The targeted contrast checks cover the recorded fixtures and representative custom colors. Arbitrary uploaded images and third-party content remain variable.
