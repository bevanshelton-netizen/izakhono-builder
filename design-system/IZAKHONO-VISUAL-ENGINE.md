# IZAKHONO Visual Engine

The IZAKHONO Visual Engine is a shared, reusable presentation layer for IZAKHONO products. It turns the liquid-glass / 3D interaction style demonstrated in the reference Reel into infrastructure rather than a one-off website effect.

## Purpose

Provide a common visual runtime that can be consumed by IZAKHONO Builder-generated applications and future IZAKHONO products without coupling the product to a single external hosting provider.

## Core technology adapters

- **React Three Fiber** — interactive 3D scenes and WebGL composition.
- **ShaderGradient** — GPU-based animated gradients and atmospheric backgrounds.
- **Liquid-glass UI** — translucent surfaces, refraction-inspired effects, depth and motion.
- **Liquid Logo** — fluid brand-mark treatments where appropriate.

These are capability adapters. Product code must not depend on a vendor-hosted demo or a single third-party runtime.

## Architecture placement

`IZAKHONO CODE → BUILDER → VISUAL ENGINE → PROVISIONER → IZAKHONO CLOUD/NODES → DNS/EDGE/TLS → FORTRESS → runtime`

The Visual Engine is a presentation capability, not the system of record and not a replacement for the application runtime.

## Standards

1. **Owned-first:** source, configuration, design tokens and generated bundles remain under IZAKHONO control.
2. **Externally reversible:** external libraries may be used as replaceable adapters; no product may become hostage to one provider.
3. **Progressive enhancement:** every visual effect must have a functional non-WebGL/non-motion fallback.
4. **Performance budgets:** 3D effects must be lazy-loaded, route-scoped where possible, and disabled or reduced on constrained devices.
5. **Accessibility:** respect reduced-motion preferences, preserve keyboard interaction, readable contrast and semantic HTML.
6. **Security:** WebGL assets and shader inputs are treated as untrusted application inputs; no arbitrary executable content is accepted through theme configuration.
7. **Brand consistency:** IZAKHONO design tokens control typography, spacing, radii, glass surfaces, lighting, depth and motion.
8. **Evidence-gated release:** visual capability availability must not be represented as production-live until deployment and acceptance evidence exists.

## Reusable primitives

The target shared library exposes primitives such as:

- `GlassSurface`
- `GlassPanel`
- `GlassButton`
- `LiquidBackground`
- `ShaderGradientScene`
- `ThreeScene`
- `LiquidLogo`
- `DepthCard`
- `MotionReveal`
- `ReducedMotionBoundary`

Products can compose these primitives without rebuilding the visual system from scratch.

## Builder integration

IZAKHONO Builder should treat the Visual Engine as a first-class capability in application recipes. A generated application can declare a visual profile, for example:

```yaml
visual:
  engine: izakhono-visual
  profile: cinematic-glass
  webgl: progressive
  motion: adaptive
  logo: liquid
```

The profile controls presentation only. Business logic, authentication, payments, provisioning and security remain independent.

## Initial profile

**cinematic-glass** is the first standard profile: dark premium surfaces, controlled translucency, depth, restrained animated gradients, cinematic 3D hero composition and subtle liquid brand motion.

The profile must remain configurable so individual IZAKHONO brands can use their own identity without forking the infrastructure.
