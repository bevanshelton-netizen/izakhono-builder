# IZAKHONO Repo Capability Pack v1

This pack turns useful public GitHub projects into **capability references** for IZAKHONO BUILDER without copying third-party source into the Builder repository.

## Rule

Use the external repository as a capability/reference only. Do not vendor, clone, or silently redistribute third-party code. Before production adoption, inspect the upstream license, dependencies, security posture, maintenance status and required API keys.

## Included from the current reference reel

### 1. MoneyPrinterTurbo

Upstream: `https://github.com/supersonic13/moneyprinterturbo`

Capability: topic/keyword -> script/copy -> media -> subtitles -> music -> rendered short video.

IZAKHONO use:

- marketing-video generation for IZAKHONO products;
- campaign variants for FAISReady, Edu-Build, I-CONNECT and other revenue products;
- batch generation of short-form promotional content;
- future integration into the Growth Leads / Creator workflow.

Gate before customer/public use:

- verify upstream license and dependency versions;
- keep provider/API credentials server-side;
- scan generated media and metadata;
- require human/owner approval before publishing;
- never represent generated claims as verified facts without evidence.

### 2. Universal Modder

Upstream: `https://github.com/rehan-remade/universal-modder`

Capability: gives coding agents structured skills for game reconnaissance, modding routes, reverse engineering, asset generation, testing and packaging for games the owner actually owns.

IZAKHONO use:

- establish a dedicated **IZAKHONO Game Lab** build lane;
- generate game/mod prototypes from a controlled project brief;
- reuse its agent-skill/playbook approach as a reference for other specialized build agents;
- keep game work isolated from revenue web applications.

Safety boundary:

- single-player/offline and owner-owned games only;
- no anti-cheat bypass, DRM bypass, multiplayer cheating or unauthorized access;
- backup saves before changes;
- require approval before installing loaders, driving input or publishing.

## Factory integration

These capabilities are **optional modules**, not mandatory dependencies of the core Builder.

`BUILD -> VALIDATE -> SECURITY GATE -> RELEASE CANDIDATE -> DEPLOY`

MoneyPrinterTurbo belongs primarily to **Marketing/Creator** workflows.
Universal Modder belongs primarily to the **Game Lab** workflow.

Neither module is allowed to weaken the existing security gate, internal-repository source-of-truth policy, owned-first infrastructure policy or evidence-gated deployment rules.

## Next intake rule

When another reel identifies additional repositories, add them to this pack only after the exact upstream repository and license are verified. Do not guess a repository from a screenshot when the repository name is not legible.
