# Team Alpha — Premium Redesign Implementation Plan

Status: planning and initial remediation. Reference: https://www.revepod.com/dashboard (not accessible for authenticated visual inspection; no competitor-specific features verified).

## Baseline verified in source
- Frontend: React 19, Vite 7, Tailwind CSS 3, Framer Motion, React Router.
- Backend: Express, MongoDB/Mongoose, Cloudinary, JWT, Google APIs, Nodemailer, Socket.IO.
- Existing functionality includes quote-to-WhatsApp, gallery and CRM/admin modules.
- Root README contained unresolved merge conflict markers.
- Repository is public; .gitignore ignores .env files but does not prove Git history is free of secrets.

## Design direction (proposal, not a claim about Revepod)
- Distinctive luxury wedding brand: restrained editorial typography, elegant neutral palette, generous whitespace, cinematic image-led layouts.
- Responsive navigation, consistent component library, refined micro-interactions, reduced-motion accessibility.
- Public website: home, stories/portfolio, services, about, inquiry, clear premium positioning.
- Admin/dashboard: cohesive design tokens, accessible navigation, KPI cards, lead pipeline, bookings, galleries, invoices and deliverables.
- Preserve existing data models, endpoints and operational workflows unless explicitly approved.

## Implementation phases
1. **Baseline and safety:** audit routes, auth, secrets, dependencies and deployment; document backup/rollback and create CI lint/build/test checks. Do not publish credentials.
2. **Design system:** establish tokens, reusable components, typography, spacing, breakpoints and motion rules; obtain reference screenshots or test account before any direct competitor comparison.
3. **Public site:** redesign page layouts, optimize gallery media and responsive navigation, add metadata and structured data, preserve SEO URLs.
4. **Lead capture:** validate event date, event types and contact fields; save leads server-side with consent and anti-spam protections, then optionally open WhatsApp. Confirm CRM API contract before implementing.
5. **Dashboard:** modernize CRM navigation and workflows while preserving business logic and permissions; test admin roles and client data separation.
6. **Performance and accessibility:** image sizing/lazy loading, bundle splitting, keyboard and screen reader behavior, Core Web Vitals and mobile QA.
7. **Release:** run dependency/security audit, build/lint/tests, staging smoke tests, review diff and draft PR; merge/deploy only after owner approval.

## Acceptance criteria
- No secrets in tracked files or new commits.
- Existing CRM, gallery, invoice and inquiry flows pass regression checks.
- Frontend lint/build pass and backend startup/critical endpoints are verified in staging.
- Mobile layouts at 360, 768, 1024 and 1440px.
- Accessibility: labels, focus, contrast, keyboard operation, reduced-motion support.
- SEO: unique titles/descriptions, canonical tags, social previews, sitemap and robots review.
- Deployment rollback instructions documented.

## Reference gap
The competitor URL was not accessible through available inspection tools. A screenshot set (desktop/mobile, dashboard overview, navigation, lead management, gallery and invoices) or a permitted demo account is needed to ground detailed comparisons. Do not clone source code, copyrighted graphics or brand assets.

## Change control
Work only on feat/premium-redesign-revepod-audit. Keep main unchanged. Do not merge, deploy or modify production secrets without explicit approval.


## RevePod screenshot-based competitive audit — 16 October 2026
Source: 18 user-supplied desktop screenshots; observations describe visible UI only, not tested functionality.

### Visible navigation and modules
- Dashboard: date range, receipts, balance due, net profit, weddings booked, enquiry pipeline, conversion, action queue, weekly crew calendar, deliveries due, incomplete projects, booking outlook.
- Enquiries: tabs for enquiries/landing page/analytics; search and status/source/time filters, add enquiry.
- Quotations: gated in provided account; feature description mentions client acceptance, change requests and revision history, but implementation unverified.
- Projects: all/active/completed/archived, CSV import/export, sorting, event list.
- Crew Scheduling: month/week/day/list/by-crew modes and unassigned events.
- Post Production: active/upcoming/completed/archived tasks, project/member/type/status filters.
- Client Requests: open/done requests for extra photos, re-edits and album changes.
- Data: storage location of captured footage by crew/event; CSV tools.
- Finances: received, balance due, team payouts, expenses, net profit; project finance, expenses, crew, accounts, transactions and invoices tabs.
- Team: roster and freelancer priority, contact visibility in client portal.
- RevePod AI: visible WhatsApp/email/log tabs and configurable notification triggers (new project, team added, event assignment, post-production assignment, payment due/received, deliverable ready). Screenshots do not prove delivery reliability or AI behavior.
- Settings: services, packages, payment/invoice, contracts, documents, team access, domain, security. Invoice settings mention GST, bank details and UPI QR.
- Profile: brand logo, studio information, currency, timezone.

### Original Team Alpha product direction
Build a unified Team Alpha Studio OS with a distinct premium editorial design, not a visual clone: deep plum/charcoal navigation, champagne accent, warm ivory surfaces, restrained typography, accessible contrast, deliberate spacing and reduced-motion-aware transitions. Keep public portfolio styling distinct from operational dashboard.

### Priority order
P0: authentication/authorization and tenant isolation, security and secrets review, backup/restore, route audit, verified CI.
P1: design tokens and responsive dashboard shell, enquiries pipeline, project overview and conversion from lead to project, WhatsApp follow-up with consent.
P2: crew availability/conflict detection, deliverable pipeline, client request portal, payment ledger and invoices with GST configuration.
P3: media/NAS metadata tracking (no unapproved direct NAS access), contract templates, analytics, automation logs and optional AI.
Avoid unverified claims that any proposed functionality already exists in Team Alpha.

### Technical design constraints
- Preserve current React/Vite/Express/Mongoose contracts until inspected and regression-tested.
- For finance, use auditable transaction records, server-side validation, integer paise and explicit tax handling.
- For WhatsApp, use approved providers, opt-in/opt-out, template approval, delivery status and rate limiting.
- For client portal, enforce project-scoped permissions and signed media URLs.
- For NAS, store asset location/checksum/backup status metadata; never expose local SMB credentials to browser.
- Use original icons/assets; no competitor branding, screenshots or copyrighted design assets in production.
- Screen designs are reference inspiration; test functionality before comparing operational performance.
