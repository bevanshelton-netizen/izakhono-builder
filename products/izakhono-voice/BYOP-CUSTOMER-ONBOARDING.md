# IZAKHONO VOICE — Bring Your Own Phone (BYOP)

## Product rule

IZAKHONO supplies the software platform. The customer supplies their existing cellphone, SIM, mobile number and ordinary mobile connectivity. A customer is not required to buy a handset, SIM, PBX or separate office telephone system from IZAKHONO.

The customer-facing product is a software subscription: AI receptionist, business knowledge and call instructions, call handling, dashboard, call records, reporting and supported integrations.

## What connects the customer's phone to the software

A normal mobile SIM does not expose every incoming call to a cloud application. For the first release, connect the customer's existing mobile number using carrier-supported call forwarding:

1. The customer signs up and creates a business tenant in IZAKHONO VOICE.
2. IZAKHONO provisions or assigns an AI answering destination number for that tenant through an approved telephony carrier.
3. IZAKHONO records the destination number in `voice_tenant_numbers`. This is the number the carrier sends to the inbound voice webhook and is the authoritative tenant-routing key.
4. The customer registers their existing mobile number as a BYOP endpoint. Store it as customer endpoint metadata; it is not the tenant-routing authority for an incoming forwarded call.
5. The customer activates a supported forwarding rule with their mobile carrier. The carrier forwards calls from the customer's existing number to the IZAKHONO destination number.
6. The forwarded call reaches the IZAKHONO webhook, resolves the tenant from the called destination number, and enters the existing authenticated media-stream and AI session pipeline.
7. The customer tests the configured forwarding condition and can pause or remove forwarding using their carrier's controls.

The customer's original number and the IZAKHONO answering destination are two different numbers with two different roles. Never tell customers that the software directly intercepts calls on their SIM.

## Forwarding choices

Offer only options that the customer's carrier supports:
- No answer: forward when the customer does not answer.
- Busy: forward when the customer is already on a call.
- Unreachable: forward when the phone is off or outside coverage.
- Unconditional: forward every incoming call.

The default onboarding recommendation should be conditional forwarding (no answer, busy and/or unreachable), so the customer can continue answering calls personally. Unconditional forwarding is an explicit customer choice and must explain that calls will go to the AI service first.

Do not publish generic USSD/MMI activation codes as universal instructions. Codes, eligibility, forwarding charges, voicemail interaction and cancellation procedures vary by carrier, account and plan. The onboarding UI should identify the customer's carrier and show verified carrier-specific instructions only after those instructions have been confirmed. Otherwise direct the customer to their carrier's official support channel.

## Endpoint data and security

Migration `002_voice_byop_endpoints.sql` stores:
- tenant ID;
- customer-owned mobile number in E.164 format;
- IZAKHONO AI destination number in E.164 format;
- selected forwarding condition;
- forwarding verification state and optional carrier label.

Do not collect or store SIM PIN, PUK, ICCID, SIM serial number, carrier account password or one-time carrier authentication codes. Do not claim forwarding is active merely because a number was entered. Set `forwarding_status=verified` only after a controlled test confirms that a call reaches the correct tenant's AI answering flow.

The AI destination number must also be provisioned and enabled in `voice_tenant_numbers`. A customer-supplied mobile number must never be accepted as tenant authority from a webhook or browser request.

## Customer activation checklist

- [ ] Tenant subscription is active and its VOICE policy is enabled.
- [ ] An approved AI destination number is assigned and mapped to the tenant.
- [ ] Customer's existing mobile number is captured and confirmed.
- [ ] Carrier and desired forwarding conditions are recorded.
- [ ] Customer receives carrier-specific activation guidance that has been verified for that carrier.
- [ ] Customer activates forwarding with their carrier.
- [ ] A test call confirms the expected forwarding condition reaches the correct business AI receptionist.
- [ ] The customer confirms the greeting, business information, call transfer destination and fallback behaviour.
- [ ] Forwarding status is marked verified only after the test succeeds.

## Scope boundaries

BYOP does not remove the need for a telephony carrier to deliver calls to the AI destination number. IZAKHONO supplies the software and orchestrates the connection; carrier number rental, forwarding and call transport may carry separate wholesale costs. The customer subscription should remain simple and predictable, while carrier charges and included usage must be transparently accounted for in the commercial plan.

South African number availability, number type, local caller ID, forwarding support and tariffs must be confirmed with the chosen carrier before promising specific numbers or pricing. Do not assume a South African DID is available from any particular provider.

## Release phases

**MVP:** BYOP via carrier-supported forwarding to a tenant-assigned IZAKHONO answering number.

**Later:** approved carrier integrations and authorised mobile-device integrations where technically and legally supported. A future Android app may offer additional controls, but it must not be represented as able to intercept all ordinary cellular calls by default.
