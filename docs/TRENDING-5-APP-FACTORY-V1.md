# IZAKHONO TRENDING 5 — APP FACTORY CAPABILITY PACK v1

This pack converts the current five high-interest GitHub projects from the David Iya reel into **capabilities** for the IZAKHONO app factory. We do not copy third-party source into the Builder. Each project remains an external, replaceable adapter/reference until its license, security and operational requirements are verified.

## The five capabilities

| Source project | Capability | IZAKHONO use |
|---|---|---|
| `louis-cfm/coucou` | Agent session visibility | Ambient monitoring/control for long-running coding agents |
| `rehan-remade/universal-modder` | Agent skills + reverse-engineering workflow | Game/software experimentation and agent toolchain research |
| `harry0703/MoneyPrinterTurbo` | Automated short-video production | Marketing/content production pipeline |
| `yoinks` | Agent/developer utility workflow | Candidate productivity adapter; verify exact upstream project before activation |
| `motion-video-kit` | Programmatic video/motion production | Branded marketing video generation |

## Factory rule

These are **capability references**, not trusted dependencies. The Builder must:

1. record the upstream repository and license;
2. pin a known revision before use;
3. run the IZAKHONO security gate;
4. isolate third-party execution from owner/control-plane secrets;
5. prohibit arbitrary shell commands through Owner mode;
6. keep generated customer apps independent of the third-party source;
7. provide a local/free-first fallback where practical;
8. record provenance in the build/release receipt.

## Money-first application

The highest immediate commercial value is the media capability stack:

`topic → script → assets → voice/subtitles → branded short → QA → publish-ready package`

This can feed IZAKHONO marketing, Edu-Build, FAISReady, The Business of Music, I-CONNECT and other revenue projects without making those products depend on the upstream projects.

## Security gate

No capability is production-enabled merely because its upstream README says it is safe. Before an adapter can reach a release candidate, the Builder must prove:

- authentication and authorization boundaries;
- resource ownership;
- payment amount integrity;
- webhook signature verification;
- rate limiting on authentication and paid APIs;
- secret isolation;
- adversarial tests that demonstrate the expected denial behavior;
- artifact provenance and reproducibility.

## Important upstream verification note

The reel names five projects but the screenshots do not expose complete repository URLs for every item. `Coucou`, `Universal Modder` and `MoneyPrinterTurbo` are independently identifiable. `Yoinks` and `Motion Video Kit` must be resolved to their exact upstream repositories before automated installation. The Builder therefore stores them as **candidate adapters**, not executable dependencies.

## Release principle

**Borrow capabilities. Own the factory.**

The IZAKHONO Builder remains the source of truth, with internal repositories and owned-first infrastructure. External projects are replaceable acceleration layers, never the foundation of customer delivery.
