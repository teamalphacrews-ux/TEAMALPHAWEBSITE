# Studio OS assistant connections

Studio OS provides owner-only, manually requested text drafting for OpenAI and Claude. The owner reviews and copies each draft. A draft does not send a client message, issue a quotation, record a payment or change a business record.

Google Drive continues to use the existing encrypted workspace-backup connection. Its consent grants `drive.file` access for archive files created by this integration. The Connections page can open the existing Backups & recovery workflow; this is not a general Drive file browser.

## Commercial workspace setup

1. Sign in as the workspace owner and open **Integrations**.
2. In the ChatGPT or Claude card, enter an API key privately and the model ID from that provider’s API account. Save the connection.
3. Use **Test connection** to send a small test prompt. The provider can bill for this request. A saved key shows **Configured**. A successful test shows **Verified this session**.
4. Enter a draft prompt and review the provider-sharing consent before generating. Review the output before copying it to a client message or document.

The commercial backend needs its existing `VAULT_SECRET` to encrypt and decrypt each workspace’s provider key. Keep the configured key stable. Owners can replace or disconnect their own provider settings. A consumer ChatGPT or Claude subscription does not supply an API key or API balance.

## Personal installation configuration

Set these values in the backend host's private environment settings. Never put credentials in chat, frontend `VITE_*` values, source files or Studio profile fields. An OpenAI/Claude API account and provider billing are separate from a consumer chat subscription.

| Assistant | Required environment values | Capability |
| --- | --- | --- |
| ChatGPT / OpenAI | `OPENAI_API_KEY`, `OPENAI_MODEL` | Client replies, quotation wording and project updates via the Responses API |
| Claude | `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` | The same draft-only tasks via the Messages API |
| OpenClaw | `OPENCLAW_GATEWAY_URL`, `OPENCLAW_GATEWAY_TOKEN`, `OPENCLAW_PRIVATE_GATEWAY_CONFIRMED=true` | Private gateway connection check only |

Choose an API model available to your provider account; the application deliberately has no default model. Restart/redeploy the backend after configuration, then explicitly select **Test connection**. The status endpoint reports configuration readiness, never successful verification based solely on a saved key. A test invokes a small billed inference for OpenAI or Claude, containing a fixed connection-check prompt and no client context.

OpenClaw's bearer token provides operator access. Follow its [documented security boundary](https://docs.openclaw.ai/gateway/openai-http-api#security-boundary-important): keep the gateway on private ingress or a private tunnel. A backend hosted on Render cannot reach an operator's Mac loopback address; use a correctly secured private network connection. Remote URLs require HTTPS; loopback HTTP is permitted for local development. URLs with embedded credentials, paths, query strings or fragments are rejected, and redirects are refused. Do not expose the operator gateway publicly. The confirmation variable is a server-operator assertion, not an automatic network-security audit.

The OpenClaw test only requests `GET /v1/models` and accepts a supported nonempty model list. It does not perform inference or prove that a specific agent is safe. Drafting remains disabled until a dedicated assistant gateway with restricted tools and permissions is independently verified. The browser cannot supply a gateway URL, key, model, arbitrary request path or tool definition.

## API and privacy

All endpoints require an authenticated studio owner. Commercial requests use the current workspace’s encrypted credentials. Personal requests use the server environment settings. The OpenClaw connection check is available in personal installations.

* `GET /api/integrations/assistants/status` returns public configuration status, model identifiers, task names and setup guidance. It performs no provider request.
* `POST /api/integrations/assistants/:provider/connection` saves `{apiKey, model}` for the signed-in commercial workspace. `DELETE` removes that workspace’s saved connection. Both return the provider status without the API key and perform no inference.
* `POST /api/integrations/assistants/:provider/test` accepts an empty body.
* `POST /api/integrations/assistants/:provider/draft` accepts only `{task, context, tone, consent:true}`. Tasks are `reply`, `quotation`, `project-update`; tones are `warm`, `professional`, `concise`. Context is manually entered and limited to 12,000 characters.

The form must disclose that the selected provider receives the entered context and require explicit sharing consent. Avoid passwords, API keys, full payment details and unnecessary client information. Context and output are not stored in the Studio OS database or application logs by this integration. OpenAI requests set `store:false`. Providers' own processing, retention and billing policies still apply; the integration does not promise zero provider retention.

Drafting instructions require review, prohibit invented commercial facts and mark missing details `[to confirm]`. These are drafting guidance, not a guarantee of factual accuracy. Render draft text as text, never trusted HTML.

Provider requests respect the existing archive-maintenance pause gate. The adapter enforces a 30-second deadline across request and response, a 256 KiB response limit, at most six requests per minute per owner, one in-flight request per owner and three per server process. The in-memory limits are intentionally bounded; multiple production instances also need a shared ingress limiter and provider spending limits. A process restart resets the local window. Provider failures return controlled messages without forwarding raw response bodies, keys or exception details.

## Verification

Run `node --test tests/studio-assistants.test.js` from `backend`, then the existing module-access/maintenance tests after router registration. The focused suite covers payload and consent validation, no-network preview/setup states, fixed provider contracts, OpenClaw's read-only test, secret-free error responses, response/time bounds, duplicate/rate/concurrency controls, and owner/workspace/maintenance enforcement.

Real provider tests require privately configured credentials and an owner-triggered connection check. They must not be faked or described as passed when credentials are absent. Local sample previews do not dispatch provider requests. No production deployment, credential generation or changes to existing Google/WhatsApp connections are part of this configuration guide.
