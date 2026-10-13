# IZAKHONO BOOKING — MVP ARCHITECTURE

## User surfaces

1. Public booking page
2. Customer booking flow
3. Owner dashboard
4. Business onboarding
5. Service/staff/availability management

## Domain model

- Business
- User
- Staff
- Service
- AvailabilityRule
- Customer
- Booking
- Payment
- NotificationJob

## Booking rules

- Store business timezone explicitly.
- Convert customer display times from the business timezone.
- Prevent overlapping confirmed bookings for the same staff/resource.
- Expired holds cannot become confirmed bookings.
- Cancellation and rescheduling are state transitions, not destructive deletes.

## API boundary

`POST /api/businesses`
`POST /api/services`
`GET /api/availability`
`POST /api/bookings`
`PATCH /api/bookings/:id`
`POST /api/payments/checkout`
`POST /api/notifications/reminders/run`
`GET /api/dashboard/summary`

## Provider boundaries

Payment, email, WhatsApp/SMS and hosting providers are adapters. Business logic must not depend directly on a provider SDK.

## Acceptance gates

- unit/domain validation
- booking conflict tests
- timezone tests
- payment sandbox test
- reminder delivery test
- PWA install test
- database backup/restore rehearsal
- HTTPS deployment evidence
- owner acceptance
