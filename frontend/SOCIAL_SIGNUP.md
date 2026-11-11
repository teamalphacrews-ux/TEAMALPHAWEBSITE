# Commercial social signup

Google and Apple use the existing commercial OAuth endpoints and tenant provisioning flow. This frontend change does not enable registration, configure provider credentials, or change personal Team Alpha authentication.

## Frontend behavior

- Read provider readiness from `/api/saas/config`; unavailable providers remain disabled with an explanation. A failed readiness check offers Retry.
- Opening a provider or submitting an email form locks all alternative submission controls to prevent duplicate actions.
- Complete a same-tab, short-lived OAuth exchange before showing the studio setup form. Remove the exchange ticket from the URL immediately.
- Show the verified provider email separately from editable studio and name fields. A surname is optional, including when Apple returns no name or a private relay address.
- Display field-specific validation and keep entered details after correctable errors. Expired, cancelled or uncertain exchanges require a fresh sign-in.
- Use bounded readiness and social-sign-in requests, visible loading feedback, keyboard focus and reduced-motion support.

## Private backend configuration

Use a dedicated commercial OAuth configuration. Keep client secrets and signing keys in private API environment settings; never add them to a `VITE_` variable or commit them.

The commercial API also needs `SAAS_ENABLED=true` and `FRONTEND_URL` set to its exact commercial frontend origin (currently `https://studio-x-os.onrender.com`). The callback return must not point to personal Team Alpha. Keep `SAAS_SIGNUP_ENABLED=false` until release verification is complete.

Google:

- `SAAS_GOOGLE_CLIENT_ID`
- `SAAS_GOOGLE_CLIENT_SECRET`
- `SAAS_GOOGLE_REDIRECT_URI=https://studio-x-os-api.onrender.com/api/saas/oauth/google/callback`

Create a Google Web application OAuth client with the exact callback above. Configure the consent screen and test users where required. This flow requests identity scopes; it does not connect Gmail, Calendar or Drive.

Apple:

- `SAAS_APPLE_CLIENT_ID` — web Services ID
- `SAAS_APPLE_TEAM_ID`
- `SAAS_APPLE_KEY_ID`
- `SAAS_APPLE_PRIVATE_KEY` — private P-256 `.p8` key
- `SAAS_APPLE_REDIRECT_URI=https://studio-x-os-api.onrender.com/api/saas/oauth/apple/callback`

Apple web sign-in requires the appropriate Apple Developer account, primary App ID with Sign in with Apple, associated Services ID, domain and return URL configuration, and signing key. Apple callbacks require HTTPS and cannot use localhost or an IP address. Confirm account membership before activation. Names may be supplied only on the first authorization, so the setup form supports entering a name afterward.

Official setup references: [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect), [Apple web configuration](https://developer.apple.com/help/account/capabilities/configure-sign-in-with-apple-for-the-web/).

## Release verification

Keep `SAAS_SIGNUP_ENABLED=false` until the commercial backend and tenant isolation release checks are complete. Existing members may sign in while registration is closed. Follow the existing SaaS release checklist before opening registration.

1. Configure providers privately on the commercial API and confirm public readiness.
2. Test Google and Apple consent and cancellation with test accounts, including Apple private relay and missing names.
3. Verify new studio ownership, separate tenant data, returning-member login and duplicate-account handling.
4. Test expired/reused tickets, request failures, browser Back, refresh, keyboard navigation and phone layouts.
5. Confirm personal Team Alpha login and Google integrations remain separate.

Frontend validation for this change: 306 tests passed; targeted ESLint passed; commercial Vite build passed. Local browser checks covered loading, failed readiness and retry, closed registration, existing-member access, duplicate-submission prevention, callback errors, Apple setup validation, and a 390px phone content width. Provider-enabled browser fixtures were local UI mocks and created no real accounts. Real Google/Apple consent, provisioning and live deployment remain unverified until private configuration and release checks are completed.
