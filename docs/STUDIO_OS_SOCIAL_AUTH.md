# Studio OS Google and Apple sign-in

Implemented locally. No provider credentials, callback registrations, production flags or real accounts were changed. Google and Apple buttons report unavailable until the backend is configured. The existing Team Alpha, Google Calendar and Gmail authentication flows are separate and unchanged.

## Backend configuration

Use backend private settings only, never `VITE_*` values or committed `.env` files. Set `FRONTEND_URL` to the exact public product origin and configure a working MongoDB connection and strong `JWT_SECRET`. Start with `SAAS_ENABLED=false` and `SAAS_SIGNUP_ENABLED=false`; enable in a staging environment only after configuration and tests. `SAAS_ENABLED=true` permits existing account sign-in. New provider accounts and studios also require `SAAS_SIGNUP_ENABLED=true`.

Google: create a Web application OAuth client for Studio OS identity sign-in, with the product's branding, support contact and privacy/terms URLs. Set `SAAS_GOOGLE_CLIENT_ID`, `SAAS_GOOGLE_CLIENT_SECRET`, and `SAAS_GOOGLE_REDIRECT_URI`. Register the exact redirect URI `https://<backend-host>/api/saas/oauth/google/callback`. Development accepts HTTP only for localhost/127.0.0.1. Requested scopes are only `openid email profile`; this does not connect Calendar, Gmail or Drive.

Apple: requires an Apple Developer account, an appropriate primary App ID enabled for Sign in with Apple, a linked web Services ID, registered domains/return URLs and a Sign in with Apple key. Set `SAAS_APPLE_CLIENT_ID` to the Services ID, `SAAS_APPLE_TEAM_ID`, `SAAS_APPLE_KEY_ID`, `SAAS_APPLE_PRIVATE_KEY` to the private P-256 `.p8` PEM, and `SAAS_APPLE_REDIRECT_URI` to `https://<backend-host>/api/saas/oauth/apple/callback`. Apple does not allow localhost/IP return URLs. Use an explicitly approved HTTPS staging domain for end-to-end Apple testing. Keep the key private and retain it securely. No paid Apple enrollment or credential creation has been performed by this change.

The backend signs a short-lived ES256 Apple client secret when exchanging an authorization code. Apple posts its callback as form data. Only that exact callback bypasses the general API CORS middleware; the callback still requires a valid single-use state, nonce and provider token. All other API CORS policy remains unchanged.

## Frontend/API contract

1. `GET /api/saas/config` returns `authEnabled`, `enabled` (new signup), and `oauth.google.enabled` / `oauth.apple.enabled`. These contain no credentials. The UI must not claim a provider is connected based only on a button being present.
2. From an explicit button click, `POST /api/saas/oauth/google/start` (or `/apple/start`) with `{ "purpose": "signup" }` or `login`. It returns `authorizationUrl` and a random 64-character hexadecimal `browserProof`. Keep the proof in the initiating tab's session storage, then navigate to the allowlisted provider URL.
3. The backend callback exchanges the code and verifies the signed identity token. It redirects to the configured frontend's `/studio-os/auth/callback#ticket=<64-hex-ticket>`. A failure returns only a fixed error code: `cancelled`, `expired`, `unavailable`, or `verification_failed`.
4. The frontend removes the fragment from browser history, then sends `POST /api/saas/oauth/complete` with the `ticket` and `browserProof`. An existing member gets the normal workspace `{ token, user }` response. A new studio receives `{ needsWorkspace: true, profile: { email, firstName, lastName } }`; collect studio name and display names, then submit the same ticket/proof with those details. Do not accept an email, provider identity, role or workspace ID from the browser for provisioning.
5. Clear proof/ticket after success, cancellation, expiry or unrecoverable failure. Do not embed session tokens in a URL or persist provider tokens.

## Security and lifecycle

- A short-lived global `SaaSOAuthFlow` record stores hashed state, nonce, browser proof and ticket; a TTL index deletes expired records. Application checks enforce expiration regardless of MongoDB TTL timing. The Google PKCE verifier exists server-side only until callback completion/failure. Neither provider access nor refresh tokens are retained.
- Google authorization uses S256 PKCE. Both providers use a fresh nonce and a single-use callback claim. Completion requires proof held only by the initiating browser tab, preventing a forwarded callback link from logging someone into the wrong account.
- ID tokens use RS256 verification against fixed provider JWKS endpoints with bounded cache and bounded requests. Issuer, audience, authorized presenter, expiry, issued-at age, nonce and verified email are checked; unsupported algorithms and malformed tokens fail closed.
- Identity is the immutable `(oauthProvider, oauthSubject)` pair on the global account. Email is never used to automatically link accounts. If the verified email already belongs to a password account or another provider, the user must use the original sign-in method. Cross-provider linking is intentionally not implemented.
- Social accounts have a random unusable bcrypt password hash for compatibility with the account schema; no password is generated for or disclosed to a user.
- Completion claims are atomic. An account-level provisioning lease and a second membership check prevent parallel social sign-ins from creating multiple initial studios. Failed or interrupted attempts require a fresh sign-in; successful existing membership is reused on retry.
- Apple names arrive only on initial consent and are sanitized display text. Only the verified token supplies identity/email, including Apple private-relay addresses.

## Required staging validation before launch

Unit tests cover actual JWT signatures and claim rejection, state/proof/PKCE, expiry/replay, disabled registration, email collisions, existing-account sign-in, onboarding and concurrent completion. They use isolated in-memory model doubles; they do not prove live provider configuration, MongoDB provisioning or device/browser compatibility.

Before production: exercise Google and Apple on the approved HTTPS staging origin, cancellation/denial, repeat Apple consent/private relay, expired and replayed callbacks, concurrent signup, a lost network response and re-login, account suspension, two separate studio accounts and invitations. Check actual MongoDB unique/TTL indexes, rate limiting at the shared ingress, privacy/terms, Apple account revocation/deletion and provider security-event handling. Social invitation acceptance/account linking and account deletion/revocation flows remain launch dependencies; the current invitation page still uses a Studio OS password.

## Official references

- [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect)
- [Google OAuth web-server flow](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Apple web authorization](https://developer.apple.com/documentation/signinwithapplerestapi/request-an-authorization-to-the-sign-in-with-apple-server.)
- [Apple identity verification](https://developer.apple.com/documentation/signinwithapple/verifying-a-user)
- [Apple token exchange](https://developer.apple.com/documentation/signinwithapplerestapi/generate-and-validate-tokens)
