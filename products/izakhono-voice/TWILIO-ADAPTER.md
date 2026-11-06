# IZAKHONO VOICE™ — Twilio carrier adapter

The Twilio adapter is the first concrete carrier implementation of the existing IZAKHONO `TelephonyAdapter` interface. It uses the Twilio REST API directly through `fetch`; the vendor SDK is not required.

## Runtime-only configuration

- `IZAKHONO_TWILIO_ACCOUNT_SID`
- `IZAKHONO_TWILIO_API_KEY_SID` (preferred username)
- `IZAKHONO_TWILIO_API_KEY_SECRET` (secret)
- `IZAKHONO_TWILIO_AUTH_TOKEN` (account Auth Token fallback; secret)
- `IZAKHONO_TWILIO_FROM_NUMBER` (provisioned, voice/SMS-enabled number)
- `IZAKHONO_TWILIO_VOICE_WEBHOOK_URL` (public HTTPS endpoint)
- `IZAKHONO_TWILIO_STATUS_CALLBACK_URL` (public HTTPS endpoint)
- `IZAKHONO_VOICE_MEDIA_STREAM_URL` (public WSS media bridge)

Never commit these values. Store credentials in the deployment runtime secret manager. Prefer a restricted Twilio API Key SID/Secret pair in production; the account Auth Token is supported only as a fallback. Rotate credentials and restrict account access.

## Adapter mapping

| IZAKHONO operation | Twilio operation |
| --- | --- |
| `dial` | Create outbound Call resource |
| `answer` | Update call TwiML to connect a secure Media Stream |
| `transfer` | Update call TwiML with a Dial instruction |
| `sendSms` | Create Message resource |
| `hangup` | Update call status to completed |

Twilio answers inbound calls by requesting the configured Voice URL and receiving TwiML. The adapter's `answer` operation updates an already-created call; it is not a substitute for the inbound Voice URL handler.

## Webhook security

Validate every Twilio webhook using `X-Twilio-Signature` and the exact public URL plus decoded form parameters, using the account Auth Token and HMAC-SHA1 as specified by Twilio. Use the configured canonical public URL; do not construct it from untrusted Host or forwarded-host headers. Validate before acting on the event. Keep the existing IZAKHONO signed-ingress boundary between the carrier adapter and the internal voice runtime as a separate defence layer.

## Media bridge

The adapter only requests a Twilio Media Stream. A separately deployed WSS bridge must accept the stream, authenticate/associate the call, translate the bidirectional audio frames into the IZAKHONO real-time speech/model pipeline, enforce call limits, and emit audit events. Do not mark the service live until that bridge and real two-way audio have passed end-to-end tests.

## Activation checklist

1. Configure credentials and a voice-enabled South African number in the provider account.
2. Register the public HTTPS Voice URL and status callback URL.
3. Deploy the WSS media bridge and configure its URL.
4. Verify Twilio signatures on inbound Voice and status webhooks.
5. Verify outbound caller ID and destination permissions.
6. Test inbound/outbound audio, transfer, SMS, hangup, timeout, provider errors and replay handling.
7. Complete privacy, consent, call-recording/retention and South African regulatory checks.
8. Record evidence for every production gate in `src/provider-contract.ts`.

Until all activation gates pass, IZAKHONO VOICE remains **NOT LIVE**.
