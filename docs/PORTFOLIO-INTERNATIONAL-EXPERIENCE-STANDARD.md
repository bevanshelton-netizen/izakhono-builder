# IZAKHONO Global Experience Standard

Effective: 25 September 2026

## Purpose
Every public-facing IZAKHONO portfolio platform must look, read and behave at an international professional level while preserving its own brand identity.

This standard does **not** create one visual clone across the portfolio. It supplies a shared quality foundation: spacing, accessibility, interaction, trust, responsive behaviour, content hierarchy, forms, SEO and release gates. Platform colours, logos, imagery, typography personality and category-specific UX remain distinct.

## Non-negotiable deployment gate
A public UI must not be deployed or promoted merely because it compiles or returns HTTP 200.

A platform may cross the public deployment gate only when:
1. its own engine remains independently deployable;
2. its brand manifest is present;
3. the first screen passes the 5-second clarity test;
4. desktop and mobile browser review pass;
5. there are no broken primary interactions;
6. no placeholder, generic filler or unverified claims remain;
7. accessibility and keyboard focus checks pass;
8. forms have labels, clear status feedback and safe data handling;
9. metadata, canonical identity and share preview are platform-correct;
10. privacy requirements are met: no behavioural tracking, profiling, advertising IDs, silent analytics, UTM attribution or referral identifiers;
11. payment journeys use the approved legal merchant and gateway where applicable;
12. public HTTPS returns 200 and the intended experience is independently verified.

## Shared visual foundation
- premium spacing scale and strong whitespace;
- large, unmistakable product/platform name;
- benefit-led hero;
- one primary action above the fold;
- useful category-specific visual, not generic decoration;
- clear navigation;
- intentional typography hierarchy;
- consistent radius, focus, form, modal and feedback behaviour;
- responsive layouts at phone, tablet and desktop widths;
- accessible contrast and visible focus;
- reduced-motion support;
- no empty black hero screens;
- no excessive glow, gradients or animation that obscure the offer.

## Platform-specific identity
The global system may not overwrite:
- approved logos;
- legally required entity names;
- EDU-BUILD's official master logo structure;
- KORA's African / Kora-instrument identity;
- BEVAN SHELTON premium apparel identity;
- FORTRESS security/trust positioning;
- product-specific colours or marks already approved.

## Content standard
Every landing experience must answer in the first screen:
- What is the platform called?
- What does it do?
- Who is it for?
- Why does it matter?
- What should the visitor do next?

Copy must be concrete, not vague. Claims about accreditation, regulatory status, partnerships, credentials, live integrations, customers, performance or availability require evidence.

## Visual QA
Each release must be visually reviewed in a real browser at minimum:
- mobile portrait;
- desktop;
- navigation and primary CTA;
- one transactional/lead form where present;
- error/success feedback;
- no console-level rendering failure.

## Release states
- `legacy`: existing UI not yet assessed.
- `makeover-in-progress`: source is being redesigned.
- `visual-review`: build is complete but not deployable.
- `international-ready`: all design/quality checks pass.
- `verified-live`: international-ready plus public HTTPS 200 and intended experience verified.

No state may jump from `legacy` directly to `verified-live`.
