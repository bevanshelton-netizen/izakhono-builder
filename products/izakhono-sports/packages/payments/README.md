# Payments Adapter

IZAKHONO SPORTS uses a provider-neutral payment interface. No payment processor is hard-wired into the core.

Required adapter operations:
- createCheckout
- verifyPayment
- issueRefund
- createSubscription
- cancelSubscription
- receiveWebhook

Providers can be plugged in per market. Production credentials and commercial authorization are required before enabling live collection.

Recommended initial commercial flows:
1. Organisation subscription
2. Competition registration
3. Athlete/Sports ID premium services
4. Sponsor marketplace commission
5. Sponsor analytics premium
