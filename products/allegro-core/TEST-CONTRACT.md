# Allegro Core Test Contract

CI must prove, without external services:

1. health reports owned durable persistence;
2. booking creation returns a code and lookup retrieves the same booking;
3. growth intake persists successfully;
4. payment webhooks without a reference are rejected;
5. repeated webhook delivery is accepted without creating a duplicate event;
6. external adapters remain optional and non-blocking.

No test may trigger a real financial charge.
