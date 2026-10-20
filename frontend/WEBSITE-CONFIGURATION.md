# Public website configuration

The redesign uses the existing React/Vite application and the existing CRM enquiry webhook. It does not change the backend schema, admin authentication, private gallery API or operational records. Public content is deliberately separate from private client galleries: the existing gallery and studio settings routes require administrator authentication and are never requested by visitors.

## Same-origin website gateway

`website-server.mjs` exports `createWebsiteRouter({ env, fetchImpl })`. Mount it at `/api/website` in the existing frontend Express service and Vite middleware. It exposes only:

| Route                         | Purpose                                                       |
| ----------------------------- | ------------------------------------------------------------- |
| `GET /api/website/content`    | Explicitly published, allowlisted public content              |
| `GET /api/website/reviews`    | Live Google Places reviews, with attribution                  |
| `POST /api/website/enquiries` | Validated same-origin proxy into the existing enquiry webhook |

No browser request includes an admin token or a private API key. All three responses use `Cache-Control: no-store`. Enquiry success is returned only after the existing CRM webhook confirms it saved the lead. HTTP redirects are rejected upstream.

## Server environment variables

Never prefix these secrets with `VITE_`, commit their values or put them in the public manifest. Load them into the frontend **server process** using the hosting provider's secret settings. The backend remains a separate, existing service.

| Variable                         | Required            | Meaning                                                                                                                                                                                                                                                                                                                                              |
| -------------------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `WEBSITE_ENQUIRY_WEBHOOK_URL`    | For form delivery   | The existing backend's HTTPS `/api/webhooks/enquiries` endpoint. HTTP is allowed only for localhost development.                                                                                                                                                                                                                                     |
| `WEBSITE_ENQUIRY_WEBHOOK_SECRET` | For form delivery   | Same secret already configured as the backend's `ENQUIRY_WEBHOOK_SECRET`; at least 32 characters and no spaces.                                                                                                                                                                                                                                      |
| `WEBSITE_PUBLIC_ORIGIN`          | Production required | Canonical HTTPS origin such as `https://teamalpha.example`, without path, query, fragment or credentials. In development, if absent, the request origin must match the frontend request's protocol and host. Production form delivery fails closed without this value. Set the correct origin and proxy configuration when terminating TLS upstream. |
| `GOOGLE_PLACES_API_KEY`          | For live reviews    | Server-only key authorized for Places API (New), with billing enabled. Restrict the key to Places API and the server's allowed IP addresses.                                                                                                                                                                                                         |
| `GOOGLE_PLACE_ID`                | For live reviews    | Verified Place ID of the studio's Google Business Profile. Do not use a guessed profile.                                                                                                                                                                                                                                                             |
| `WEBSITE_REVIEWS_ENABLED`        | Optional            | Set to `false` to disable API review fetching. The published manifest can hide the entire reviews section separately.                                                                                                                                                                                                                                |
| `WEBSITE_CONTENT_FILE`           | Optional            | Absolute server path to an approved public JSON manifest. Takes precedence over URL. Do not point this at a database dump or admin export.                                                                                                                                                                                                           |
| `WEBSITE_CONTENT_URL`            | Optional            | HTTPS URL of an explicitly public publication manifest. No auth headers or cookies are attached.                                                                                                                                                                                                                                                     |
| `WEBSITE_CONTENT_ALLOWED_HOSTS`  | If URL used         | Comma-separated exact hostnames permitted for the public manifest; no wildcard, redirects, local hosts or IP literals.                                                                                                                                                                                                                               |

Without enquiry credentials the form reports that online enquiries are being configured and offers direct contact. It never pretends a lead was saved. Without Google credentials no rating or review is invented; a restrained link to the studio's Google search/profile remains. Verify the final Business Profile link in the publication manifest.

## Public content publication

The default content uses only images already supplied for the public website. Collections are labelled as editorial selections, with no invented couples, dates, venues, client approvals or films. Hero media is not part of this manifest. At the owner's later request, the original banner image was removed from the carousel and replaced with their four supplied wedding photographs. Originals remain intact; responsive WebP derivatives are used by the frontend.

The checked-in `public/site-content.json` is a publication example. It can be edited and approved by the website owner or replaced with a public CMS publication file through `WEBSITE_CONTENT_FILE` / `WEBSITE_CONTENT_URL`. This is **not** a new admin content manager. Because this change is frontend-only, full authoring controls inside the existing admin require a separately authorized backend/CMS extension. Existing admin media must not be silently made public.

Only these fields are projected to visitors:

- `site`: name, tagline, city, phone, email, Instagram, WhatsApp and Google Maps URLs.
- `categories`: stable lowercase IDs and display labels.
- `stories`: `published: true`, stable ID/slug, title, category, introduction, approved images and optional approved location. `featured: false` removes a published story from the homepage selection while keeping it in the complete portfolio; omitted `featured` defaults to true. Every image needs `approved: true`; `src` must be a safe local path or HTTPS URL. `cover` must match an approved image. Optional `srcSet` accepts safe width descriptors. Descriptors must use the actual image width, even where the optimized filename names the requested larger size: the 1100px source `studio-pre-wedding-1280.webp` uses `1100w` because resizing does not enlarge it. Location appears only with `locationApproved: true`.
- `films`: `published: true`, stable ID, title, approved poster and HTTPS film URL. Publish films only after confirming distribution rights and a working public URL.
- `sections`: booleans for intro, portfolio, films, experience, reviews, collections and enquiry; `sectionOrder` controls their order.

Unknown fields, private records, internal notes, client email addresses, unpublished stories and unapproved images are omitted. This allowlist is a privacy boundary, not a substitute for reviewing the publication manifest. The manifest is public by design and must never contain secrets.

## Google review requirements

The gateway uses Place Details (New), a fixed field mask, bounded responses, an upstream timeout and rate limits of 15 per address and 60 globally per minute. It fetches reviews on demand without storing Google review content in a database, file, persistent cache or browser storage. HTTP caching is disabled. Places API may return only a selection of reviews; the UI does not claim to display every review or sort by date.

The component preserves each returned author's display name, avatar, profile link, relative publish date and individual review source link, plus returned provider attributions. It requests reviews only when the reviews section is visible. A visible notice explains that Google supplies up to five reviews in relevance order and that reviews without text, rating or author details are omitted. Live Google content is visually separated from website copy and marked **Google Maps**. Review excerpts are CSS-clamped with a direct link to the original source; a translation label appears when API text differs from its original. Google terms/privacy links accompany live content. Site terms/privacy must also be published and reviewed for the actual business, incorporating the applicable Google links. If the configured place ever changes to France or a French territory, extend the projection and UI to display Google's returned visit month/year before publishing that profile's reviews.

`public/assets/google-maps-attribution.svg` is the unmodified dark-gray Google Maps logo from Google's official [Google Maps attribution asset archive](https://developers.google.com/static/maps/documentation/images/Google_Maps_Attribution_Assets.zip), linked by the Places API policy page. Its native 98 × 18 px aspect ratio is preserved. The review attribution renders it at 18 px high, with at least 10 px clear space at the top and each side and 5 px below. Do not recolor, crop, distort, animate or replace this asset with a recreation. It appears only alongside actual Google-provided review content and links to the supplied Google Maps profile.

Follow Google's current [Places API policies](https://developers.google.com/maps/documentation/places/web-service/policies), [Place Details documentation](https://developers.google.com/maps/documentation/places/web-service/place-details) and [Google Maps Platform terms](https://cloud.google.com/maps-platform/terms). The studio must confirm billing region and the terms applicable to its Google account before enabling the integration.

## Enquiry delivery and spam controls

The progressive form sends a stable random `Idempotency-Key`, a start timestamp and an empty honeypot. The gateway validates all fields, checks same-origin submission, rejects too-fast or expired forms, limits the body to 16 KB and limits new submissions to five per address per hour and 60 globally per minute. All attempts, including retries, are bounded to 20 per address per minute. It rejects unexpected fields, unsafe control characters, invalid dates/phone numbers and duplicate request IDs with changed payloads. The server forwards the stable prefixed receipt key to the existing webhook so retries do not create duplicate leads. Configure trusted proxies only for your hosting provider; arbitrary forwarded IP headers are not trusted by this router.

Name, email, phone, event type, date and city use the existing Lead fields. Venue, requested coverage, deliverables, budget, source page, additional details and the explicit unconfirmed availability note go into the existing bounded notes field. The backend remains responsible for status, creation time and durable idempotency. No date is advertised as confirmed availability. Client records and portal accounts are not created by this frontend.

For multi-instance production hosting, place a shared rate limit/WAF in front of this service. Current in-process limits protect one process and are not a distributed anti-bot service. If stronger spam prevention is needed, add a verified server-side challenge integration in a future authorized change.

## Verification

Run `node --test test/website-server.test.mjs` from the frontend directory. Tests use a local ephemeral HTTP listener with injected upstream transports; they make no Google or CRM network requests. Tests cover the publication privacy boundary, absent integrations, attribution preservation, no caching, origin/honeypot/date/field guards, rate bounds, safe error responses and stable CRM idempotency.

Production acceptance still requires verified Google credentials/Profile, the existing backend webhook secret and URL, approved real portfolio content/film URLs, a real enquiry delivery check in the admin console, and measurements on the final hosting/CDN configuration. Do not claim these external integrations are live from a sample-data preview.
