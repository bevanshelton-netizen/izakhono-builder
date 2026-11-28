# IZAKHONO NODE ENGINE — Single-Device Local Hosting Blueprint v1

**Status:** Engineering blueprint and staged implementation plan  
**Branch:** `build/izakhono-node-engine-local-host-v1`  
**Owner:** IZAKHONO  
**Scope:** Existing user-owned computer or compatible phone hosts its own workloads  
**Safety gate:** Documentation and source work only. No purchase, production deployment, public activation, DNS change, firewall change, or installation on a user's device is authorized by this document.

## 1. Product definition — corrected and fixed

IZAKHONO NODE ENGINE makes a compatible device the hosting platform for services that run on that same device.

A single device performs two concurrent roles:

1. **Personal device:** the owner continues ordinary computer or phone use.
2. **Local host:** the device runs the owner's selected website, web application, API, or supported business service using its own CPU, memory, storage and network interface.

This is **single-device self-hosting**. It does not require a second computer to execute the workload, a cluster, distributed computing, or a remote compute provider. A network relay, if later offered, may provide a route for visitors but must not silently execute the user's workload elsewhere.

### Non-negotiable product truths

- Localhost hosting works without public Internet exposure.
- LAN hosting lets other devices on the same trusted network reach the host.
- Public hosting is an optional, explicit publishing capability and depends on the device being powered, awake enough to run, connected, and reachable.
- Software cannot bypass ISP/router restrictions, carrier-grade NAT (CGNAT), blocked inbound ports, or mobile OS background restrictions by assertion.
- A public relay/tunnel is a networking option, not a second compute host. It must be disclosed, replaceable, privacy-reviewed and opt-in.
- User workloads must stop or pause when the owner asks, when safety limits trigger, or when the operating system revokes required capability.
- NODE01 remains a logical software/runtime identity under the repository's NODE01 identity standard. It is not the user's laptop, phone, physical server, VM, hostname or hardware asset.

## 2. Product editions and operating modes

### 2.1 Computer Edition

Target: supported Windows, Linux and macOS computers.

- **Managed application mode (MVP):** install an owner-controlled desktop application and local service/agent. The owner continues using the computer. A service may run at login or boot only after explicit consent and platform permission.
- **Dedicated/bootable mode (later):** a separate, optional appliance-style environment for compatible machines. It is not required for MVP and must not overwrite the user's operating system or disk without explicit approval and a reviewed recovery process.

The MVP is managed application mode, not a custom OS.

### 2.2 Mobile Edition

Target: Android first, with iOS capability research and a truthful capability matrix before commitment.

- **Android:** an app-managed foreground hosting session may run eligible workloads on-device, subject to Android foreground-service, battery, thermal, memory, network and background policy. The user sees a persistent notification and can stop hosting. A full Docker/container daemon is not an MVP assumption.
- **iOS:** investigate only supported foreground/local hosting capabilities and platform-approved background modes. Do not promise always-on public hosting or unrestricted background servers. If OS policy prevents a workload from continuing, the engine must report that limitation rather than evade it.
- Mobile workloads begin with small static sites and lightweight application/API workloads. Larger databases, unrestricted containers, high-throughput services and persistent always-on public hosting are out of scope until proven feasible on supported devices.

## 3. Architecture

### 3.1 Logical components

```
Owner
  |
  +-- IZAKHONO NODE ENGINE UI
  |     Desktop control panel / Android app
  |
  +-- Local authenticated control API (loopback only)
          |
          +-- Node Agent / Lifecycle Supervisor
          |      install, start, stop, pause, restart, health
          |
          +-- Resource Governor
          |      CPU, memory, disk, network, battery, thermal
          |
          +-- Workload Manager
          |      signed package, configuration, lifecycle
          |
          +-- Workload Runtime Adapter
          |      Computer: isolated process/container adapter
          |      Android: app-owned process/foreground service
          |      iOS: capability-limited supported runtime
          |
          +-- Local Web Gateway
          |      localhost by default; LAN/public bind by consent
          |
          +-- Local Data Store
          |      app state, metadata, owner-controlled volumes
          |
          +-- Security & Audit
                 owner identity, permissions, event log
```

The workload executes on the device. The gateway handles requests and forwards them to the local workload; it does not move compute to another machine.

### 3.2 Component responsibilities

**Node Agent / Lifecycle Supervisor**
- Owns a small, auditable lifecycle state machine.
- Reports installed, stopped, starting, running, degraded, paused, failed and removed states.
- Performs graceful shutdown and restart recovery.
- Uses native OS service management on desktop (Windows Service, systemd, launchd) only after user approval.
- On mobile, follows app and foreground-service lifecycle requirements; it must not disguise a service or mislead the owner about persistence.

**Local Control API**
- Binds to loopback only by default.
- Requires local owner authentication for state-changing operations.
- Uses typed actions, not arbitrary shell execution.
- Rejects requests from untrusted origins; applies CSRF/origin protections where a browser UI is used.
- No admin endpoint is exposed to the public gateway.

**Workload Manager and Package Format**
- Accepts only explicitly selected local packages in MVP.
- Package manifest records ID, version, runtime type, entry point, requested ports, storage needs, resource requests, permissions and health check.
- Validate path traversal, symlinks, archive expansion, manifest schema and package integrity.
- Later release may support signed publisher packages and verified update channels.
- No hidden background jobs, mining, remote arbitrary code execution, or third-party workload admission without owner approval.

**Runtime Adapter**
- Defines a portable contract: prepare, start, inspect, stop, cleanup and health.
- Desktop MVP can launch a restricted local static-site runtime first; container integration is an optional adapter, not a prerequisite.
- Runtime adapters must not receive host administrator/root privileges by default.
- Android adapter uses app-private files and platform-supported process/service controls.
- Runtime choice must be validated on each OS rather than assuming one container mechanism works everywhere.

**Resource Governor**
- Owner-configurable CPU and memory budgets where OS/runtime supports enforcement.
- Per-workload disk quota and network usage accounting.
- Profiles: Personal Use (conservative), Balanced, Hosting Priority (explicit opt-in).
- Dynamic throttle/pause under high foreground demand, low battery, thermal warning, low disk, or memory pressure.
- Limits that cannot be enforced on a platform are clearly marked as best-effort; do not claim hard caps without tests.
- Default hosting must not starve the owner's active personal session.

**Local Web Gateway**
- Initial binding: loopback only.
- LAN binding: separate user action; show local IP and network exposure warning.
- Public publishing: separate opt-in workflow with reachability preflight, domain/DNS guidance, TLS, abuse controls and clear exposure status.
- Gateway maps approved hostname/path to a workload and never exposes the control API or private data directories.
- Public listener ports are restricted to required HTTP/HTTPS ports; workload ports remain private behind the gateway where feasible.

**Local Data Store**
- Application metadata in a small local database (SQLite is the MVP default).
- Workload data lives in clearly displayed owner-controlled directories/volumes.
- Per-workload isolation, backup/export and deletion controls.
- Secrets stored using OS credential facilities where available; never in plaintext manifests, logs or repository files.
- Deletion requires confirmation and reports what data remains in backups.

**Availability and Recovery**
- Detect device sleep, shutdown, loss of network, workload crash and OS termination.
- Report host availability truthfully.
- Restart policy is owner-configurable and bounded; no infinite rapid restart loop.
- A host that is off, sleeping, disconnected or blocked by the network is unavailable to visitors.
- Local app must remain usable if publishing/network features are unavailable.

## 4. Security model

1. **Owner-first consent:** installation, boot/login startup, LAN exposure, public exposure, domain binding, package permissions and resource profile each require explicit owner action.
2. **Least privilege:** no root/admin runtime by default; privileged helper is minimal, isolated and independently auditable.
3. **Isolation:** each workload gets a separate identity, filesystem scope, port allocation and resource policy where supported.
4. **Safe defaults:** loopback-only, no public ingress, no auto-publishing, no automatic domain/DNS mutation.
5. **No remote administration by default:** remote control plane is out of MVP. If added later, it requires strong authentication, device pairing, revocation and threat review.
6. **Audit:** record install, start, stop, permission change, exposure change, package update, resource-limit change and deletion; avoid logging secrets or request bodies by default.
7. **Supply chain:** dependency inventory, pinned versions, reproducible build where feasible, signed release artifacts and security update process before public beta.
8. **Abuse controls:** public hosting includes owner-visible service identity, request/rate limits, emergency stop, and an acceptable-use/abuse reporting design.
9. **Fail-safe:** if the agent crashes, public gateway fails closed; private control access remains recoverable; no hidden fallback execution elsewhere.

## 5. Network and publishing model

### Stage A — Local
- Workload reachable only at a loopback URL.
- No firewall changes and no public DNS.
- This is the first acceptance target.

### Stage B — Local network
- Owner enables LAN binding.
- Display the exact interface/address and warn that trusted-network devices may reach the service.
- Do not enable on public Wi-Fi by default.
- Local gateway still executes on the same device.

### Stage C — Public Internet
Public publishing preflight checks:
- device power and sleep behavior;
- active network and address type;
- router port-forwarding capability where relevant;
- public IPv4/IPv6 reachability and CGNAT detection (as a diagnostic, not a bypass);
- inbound port availability;
- domain ownership/DNS validation;
- TLS issuance and renewal path;
- user-visible exposure and emergency stop.

Direct route is preferred when owner-controlled and safe. If direct ingress is impossible, an optional encrypted reverse tunnel/relay may be evaluated. The relay is only a transport path; the device remains the compute endpoint. Any relay has separate privacy, cost and availability disclosures and is disabled unless explicitly selected.

Public hosting cannot guarantee uptime comparable to a data centre: the owner device may sleep, reboot, lose power, change networks or be suspended by its OS.

## 6. Resource policy and owner experience

Initial conservative policy defaults (implementation must verify platform support):

| Resource | Computer default | Mobile default |
|---|---|---|
| CPU | Low-priority workload; target ≤ 20% sustained aggregate unless owner changes profile | Low duty cycle; throttle on heat or foreground demand |
| Memory | Configurable budget; reject launch if safe headroom is insufficient | Small fixed workload ceiling; refuse launch if device is under pressure |
| Storage | Explicit per-app quota; reserve free space for OS | App-private quota; pause on low-storage signal |
| Network | Owner-visible usage; no background upload by default | Wi-Fi preferred; mobile data separately opt-in |
| Battery | AC/battery profile; owner can pause on battery | Default pause/limit on low battery; charging-only mode available |
| Thermal | Monitor supported OS signals; reduce or stop on warning | Mandatory thermal throttle/stop path |
| Availability | Respect sleep and user shutdown; show status | OS lifecycle governs; show persistent foreground status where required |

These are starting product policy values, not universal OS guarantees. Final numeric defaults must be tuned by device testing and must be configurable within safe bounds.

The owner control panel must include:
- Hosting On/Off and emergency Stop All;
- workload list and state;
- local URL and exposure mode;
- CPU/memory/disk/network usage and cap;
- pause reason and restart history;
- permissions and package details;
- backup/export and uninstall;
- clear "running on this device" identity and no remote compute ambiguity.

## 7. MVP definition

### MVP-0 — Desktop local static-site host

Deliver the smallest end-to-end proof on one developer/test computer:

- supported desktop OS selected after repository/toolchain inspection;
- installable development package or documented local launch;
- local agent and control API;
- local UI with Start, Stop, Status and resource policy;
- static website package served from a controlled directory;
- loopback-only gateway;
- workload lifecycle and crash recovery;
- no container requirement;
- no account/cloud dependency;
- no public publishing, domain/DNS automation, paid service or production deployment.

**Proof:** the same computer hosts and serves the site from its own process while the owner continues using the computer. Record process identity, local listening address, logs and resource observations. This is a development acceptance test, not a public service launch.

### MVP-1 — Desktop LAN and resource safeguards
- explicit LAN exposure toggle;
- local network discovery display (no automatic exposure);
- resource measurement and best-effort enforcement;
- sleep/reboot/network-loss handling;
- uninstall and data export;
- automated security and lifecycle tests.

### MVP-2 — Desktop public publishing
- direct route preflight and clear diagnostics;
- domain/TLS workflow without automatic production DNS changes;
- optional relay architecture only after security, privacy and cost review;
- public exposure acceptance tests and rollback.

### MVP-3 — Android local hosting
- Android app with local dashboard;
- foreground hosting session with persistent user-visible notification;
- static-site runtime and one lightweight API/runtime experiment;
- app-private storage, battery/thermal/network policy;
- Wi-Fi/LAN exposure only after user opt-in;
- capability testing across supported Android versions/devices.

### MVP-4 — Mobile publishing and iOS feasibility
- Android public access only where network/OS conditions support it, with relay option separately reviewed;
- iOS feasibility report and supported prototype if platform rules permit;
- publish only capabilities demonstrated by test evidence;
- no claim of always-on iOS hosting unless Apple-supported behavior is proven for the exact app model.

### MVP-5 — Dedicated/bootable computer mode
- separate product track;
- compatibility inventory, signed image, secure boot/recovery analysis, disk-preservation safeguards and explicit install consent;
- no destructive installer until user-approved design, recovery media and hardware test matrix exist.

## 8. Development plan and gates

### Phase 0 — Repository and platform discovery
- Inspect current application architecture, package scripts, coding standards, CI and security gates.
- Choose desktop MVP target based on repository fit and testable available environment.
- Confirm dependency and runtime strategy.
- Preserve NODE01 identity standard and existing HOST/Runtime Fabric boundaries.
- Deliver: architecture decision record, supported-platform matrix, threat model.

**Exit:** no duplicate host control plane or conflicting runtime identity.

### Phase 1 — Local vertical slice
- Implement agent lifecycle interface and a minimal local static-site runtime.
- Implement loopback-only gateway.
- Implement local control API and minimal dashboard.
- Implement typed workload manifest and safe directory validation.
- Add start/stop/status and bounded restart behavior.

**Exit:** one computer serves one selected local site; all processing is on that same computer; no public exposure.

### Phase 2 — Resource and security hardening
- resource governor abstraction and platform-specific capability reports;
- permissions, local auth, audit events and secret handling;
- path traversal/package validation;
- crash, stop, shutdown and recovery tests;
- threat-model review.

**Exit:** enforced limits are evidenced where claimed; unsupported controls clearly report best-effort.

### Phase 3 — LAN admission
- explicit bind-to-LAN consent;
- network interface display and exposure warnings;
- firewall guidance (no silent firewall mutation);
- LAN integration tests and emergency stop.

**Exit:** LAN endpoint reachable only after owner enables it; control API remains private.

### Phase 4 — Public route
- direct-reachability diagnostics;
- domain and TLS lifecycle design;
- CGNAT/blocked-port diagnosis;
- optional relay ADR with cost/privacy review;
- external tests, abuse controls and rollback.

**Exit:** no public activation without owner approval and independent external acceptance evidence.

### Phase 5 — Android
- Android app and foreground service prototype;
- thermal/battery/memory/network policy;
- local site runtime and user-visible lifecycle;
- device matrix and OS policy review.

**Exit:** supported devices pass lifecycle, thermal, battery and local-network tests. Public availability remains conditional.

### Phase 6 — Release readiness
- signed builds and update strategy;
- vulnerability/dependency scans;
- uninstall, backup/restore and incident runbooks;
- accessibility and localization;
- user documentation, support and privacy disclosures.

**Exit:** reviewed release candidate with reproducible test evidence. Production launch remains a separate approval.

## 9. Acceptance test matrix

| Test | Required result |
|---|---|
| Start local site | Site responds on loopback; process runs on host device |
| Owner uses device | Personal session remains responsive under conservative profile |
| Stop workload | Listener closes and workload process exits |
| Stop All | All hosted workloads stop promptly; no hidden restart |
| Agent crash | Workload behavior follows declared policy; gateway does not expose control plane |
| Reboot | No auto-start unless owner enabled it; state is reported accurately |
| Sleep/lock | OS behavior is detected; availability is not falsely reported |
| LAN toggle off | LAN listener closes or returns to loopback-only |
| Public toggle off | Public route disabled and exposure state verified |
| Package path attack | Invalid traversal/symlink/archive package rejected |
| Resource pressure | Workload throttled/paused/stopped according to supported policy |
| Low battery/thermal (mobile) | Workload pauses or throttles and displays reason |
| Network loss | Local workload may continue; external availability reports disconnected |
| Disk full | Workload stops safely; owner data is not silently deleted |
| Uninstall | Agent removed; owner receives clear data retention/deletion choices |
| Privacy | No telemetry or remote execution without explicit disclosed consent |

## 10. Observability and evidence

Every development test records:
- device/OS and build version (non-sensitive);
- workload package ID/version;
- local process/runtime identity;
- bind address and exposure mode;
- lifecycle transition timestamps;
- resource samples and configured limits;
- test result, logs and known limitations.

Do not collect full browsing history, personal files, request bodies, passwords or private application data for routine telemetry. Local diagnostic export is owner-triggered and reviewed before sharing.

A status is **PASS** only when test output exists. A design document, branch, CI build or process start is not proof of public availability.

## 11. Explicit non-goals for this release

- distributed computing or multi-computer workload execution;
- cloud compute fallback;
- hidden mining or arbitrary third-party workloads;
- remote command shell;
- automatic public DNS or firewall changes;
- purchase or provisioning of infrastructure;
- production deployment or public launch;
- claim of 24/7 availability from a personal device;
- promise of unrestricted always-on iOS hosting;
- custom bootable OS in the first MVP.

## 12. Immediate implementation backlog

1. Inspect repository app/runtime conventions and current test harness.
2. Add ADR for the desktop MVP runtime and local gateway.
3. Create a minimal workload manifest schema and validator.
4. Implement loopback static-site host and lifecycle API.
5. Build a minimal local control panel.
6. Add lifecycle, isolation, exposure and resource-policy tests.
7. Document how to run the prototype locally without purchasing or deploying anything.
8. Keep Android as a separate adapter/product milestone, not a promise that desktop code runs unchanged on phones.

**Definition of "built" for the first milestone:** source code and automated tests demonstrate a local site served by the same device with owner-controlled start/stop and safe loopback defaults. Until that evidence exists, the product is architecture/planning work, not a functioning host engine.
