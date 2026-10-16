# Receive enquiries in Team Alpha CRM

This implementation accepts server-to-server enquiries at `POST /api/webhooks/enquiries`. Each successful delivery creates a CRM lead with status **New**. It does not create client accounts, change payments, or send messages. The endpoint is prepared in source; it must be deployed and configured before a live sender can use it.

## Setup

1. Generate a random secret of at least 32 characters with no whitespace, for example with `openssl rand -hex 32`.
2. Set `ENQUIRY_WEBHOOK_SECRET` on the **backend** service and in the trusted sender's secret store. Keep it out of browser code, Git, screenshots and public forms. Do not prefix it with `VITE_`.
3. Deploy the backend changes after review, with access to the existing MongoDB database. The lead model adds a unique sparse `webhookEventId` index; the handler explicitly ensures this index exists before processing deliveries, including when automatic index creation is disabled. The database account needs permission to create the index, or it must already exist. Existing manual leads remain unchanged. Prefer building the index during release before accepting traffic: `{webhookEventId: 1}`, with `unique: true` and `sparse: true`.
4. Configure the sender with the actual backend origin followed by `/api/webhooks/enquiries`, Bearer authentication and a stable, unique delivery identifier. The repository does not establish a newly deployed webhook URL.
5. Sign in as an admin and open **Integrations**, or call `GET /api/webhooks/enquiries/status` with the normal admin JWT, to check whether the backend has a valid secret. This endpoint never returns the secret.

## Request

Use a new idempotency key for each original enquiry and reuse that same key for retries. Keys contain 1–200 characters and no whitespace. If the header is absent, `event_id` in the JSON body is accepted as the key. The header takes precedence.

```sh
curl --request POST "$TEAM_ALPHA_API_ORIGIN/api/webhooks/enquiries" \
  --header "Authorization: Bearer $ENQUIRY_WEBHOOK_SECRET" \
  --header "Content-Type: application/json" \
  --header "Idempotency-Key: enquiry-your-provider-unique-id" \
  --data '{
    "name": "Ananya & Rohan",
    "email": "couple@example.com",
    "phone": "+91 98765 43210",
    "eventType": "Wedding",
    "eventDate": "2027-02-18",
    "eventLocation": "Bengaluru",
    "notes": "Please share availability and packages."
  }'
```

Set `TEAM_ALPHA_API_ORIGIN` to the real backend URL. Run this request from a trusted server, an automation provider or a private terminal; a public form should send to its own server, which then calls this webhook with the secret.

| Field | Rule |
| --- | --- |
| `name` | Required text, 1–120 characters |
| `email` | Required valid email, at most 254 characters; stored lowercase |
| `phone` | Optional; 7–15 digits, allowing normal phone punctuation |
| `eventType` | Optional text, at most 80 characters |
| `eventDate` | Optional real calendar date in `YYYY-MM-DD` format |
| `eventLocation` | Optional text, at most 240 characters |
| `notes` | Optional text, at most 4,000 characters |
| `event_id` | Optional fallback idempotency key |

Unknown fields are rejected. The sender cannot choose status, role, account creation, payment amounts, cloud credentials or internal webhook receipt fields.

## Responses and retry behavior

| Status | Meaning |
| --- | --- |
| `201` | Created: `{ "success": true, "leadId": "...", "duplicate": false }` |
| `200` | Already received: same lead ID, `duplicate: true`; the original lead is unchanged |
| `400` | Invalid JSON fields, contact/date format or missing/invalid idempotency key |
| `401` | Missing or incorrect Bearer secret |
| `503` | Secret unconfigured/too short, index initialization failure or temporary storage failure |

Retry transient storage failures with backoff and the **same** key, including after a connection timeout when the sender cannot tell whether the lead was saved. A database upsert and unique index provide the durable receipt across process restarts and simultaneous retries. Never reuse a key for a different enquiry. To update an existing lead, use the authenticated CRM workflow.

## Validation and remaining release checks

Run `npm test` in `backend`. Tests cover secret authentication, input rejection, repeated delivery, a competing insert and retry after an ambiguous database acknowledgement using storage mocks. Before production release, verify the unique index exists and send one staging enquiry plus a retry; confirm exactly one lead appears. These tests do not claim a live provider connection or completed deployment.

Existing media proxy/password access, production secret rotation, provider-specific signature formats and payment webhooks need separate review; they are outside this inbound-enquiry contract.
