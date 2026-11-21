# IZAKHONO PAY Merchant Webhooks

## Delivery contract

Merchant payment notifications are **at-least-once**, not exactly-once. IZAKHONO PAY assigns a stable `event_id` to a payment-paid event and reuses it across retries. A merchant must durably deduplicate by `event_id` and make its event handler idempotent.

A successful HTTP 2xx response marks the delivery as delivered. Non-2xx responses, network failures and timeouts are retried. If a receiver processed an event but its response was lost, the same event may be delivered again. This is expected and must not create a second fulfilment, invoice settlement or accounting posting.

## Headers and signature

Each request includes:

- `x-izakhono-event`: event type, currently `payment.paid`
- `x-izakhono-event-id`: stable event identifier; use this as the deduplication key
- `x-izakhono-timestamp`: Unix timestamp in seconds for this delivery attempt
- `x-izakhono-signature`: lowercase hexadecimal HMAC-SHA256 signature
- `content-type: application/json`

The signature is:

```text
hex(HMAC-SHA256(webhook_secret, timestamp + "." + exact_raw_request_body))
```

Verify the signature against the exact raw request bytes before parsing JSON. Compare signatures in constant time. Reject missing, malformed or stale timestamps; a five-minute freshness window is a reasonable receiver default. The timestamp changes on each retry, while `event_id` remains stable.

Webhook secrets must be stored in a server-side secrets manager. Never expose them in browser code, client applications, logs or support tickets.

## Retry and dead-letter policy

- Initial delivery is attempted when the payment is confirmed paid.
- A failed attempt is rescheduled with exponential backoff: 30 seconds, 60 seconds, 120 seconds and so on, capped at one hour.
- The delivery is dead-lettered after 12 attempts. Dead-lettered events are excluded from automatic retries and require operator review before any manual redrive.
- A delivery lease prevents concurrent workers from claiming the same event at the same time. A process crash can still result in a repeated delivery after lease expiry; receiver-side deduplication is mandatory.
- Scheduled retry scanning runs once per minute.

## Receiver implementation sequence

1. Read and retain the exact raw request body.
2. Validate the timestamp and HMAC signature.
3. Parse the event only after signature verification.
4. Atomically insert `event_id` into a receiver-side inbox table with a unique constraint.
5. If the event ID already exists, return 2xx without repeating business effects.
6. Process the payment event idempotently and commit the inbox state with the business effect.
7. Return 2xx only after durable acceptance.

If processing is asynchronous, durably enqueue the verified event before returning 2xx. Do not acknowledge an event that exists only in process memory.

## Payload

A `payment.paid` event contains the event ID, occurrence timestamp, merchant slug and payment intent details, including intent ID, merchant reference, amount in minor units, currency, provider, provider reference and metadata. Treat metadata as untrusted merchant-supplied data; do not use it as payment authorization evidence.

## Destination restrictions

The Worker only sends to HTTPS URLs whose hostname exactly matches `MERCHANT_WEBHOOK_ALLOWED_HOSTS`. URL credentials, IP-literal destinations, local/internal/reserved host suffixes, non-default ports and redirects are rejected. Allowlist only merchant-controlled or otherwise explicitly approved callback hosts.
