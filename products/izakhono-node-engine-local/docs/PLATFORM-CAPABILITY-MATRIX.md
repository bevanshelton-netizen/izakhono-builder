# IZAKHONO NODE ENGINE — Platform capability matrix

## Product invariant

One owner's existing computer or phone is the hosting machine. Its own processor, memory, storage and network serve its workloads while the owner remains in control and can continue using the device. This is not a multi-machine cluster or distributed-compute product.

## Current prototype status

| Target | Current status | What that means |
|---|---|---|
| Windows | Prototype runtime | The Node.js loopback prototype is intended to run on Node.js 20+ |
| macOS | Prototype runtime | The same Node.js loopback prototype is intended to run on Node.js 20+ |
| Linux | Prototype runtime | The same Node.js loopback prototype is intended to run on Node.js 20+ |
| Android | Experimental runtime only | A Node.js environment may run locally; no native app, background service or battery-aware lifecycle integration exists |
| iOS | Not supported | Requires a native app architecture and platform feasibility work; do not promise persistent hosting |

“Prototype runtime” is not a claim that installers, startup services, resource quotas, workload isolation, LAN access or public hosting are complete.

## Capability boundary today

| Capability | Current state |
|---|---|
| Local loopback website hosting | Implemented for the Node.js prototype |
| Local owner control panel | Implemented; loopback only |
| Resource admission policy | Implemented as policy checks, not OS enforcement |
| Per-workload monitoring | Not implemented |
| OS-enforced CPU, RAM and disk limits | Not implemented |
| Workload sandboxing / isolation | Not implemented |
| LAN access | Not implemented |
| Public internet ingress | Not implemented |
| Domain, TLS and relay automation | Not implemented |
| Managed background service / installer | Not implemented |
| Android native lifecycle integration | Not implemented |
| iOS native implementation | Not implemented |

## Platform engineering sequence

1. **Desktop foundation:** implement a platform adapter contract; detect OS capabilities rather than assuming equivalent behavior across Windows, Linux and macOS.
2. **Isolation before arbitrary workloads:** use OS-native mechanisms and explicit allowlists. A generic application launcher must not be enabled before resource and security boundaries are enforceable.
3. **Resource enforcement:** implement and test actual CPU, memory, disk and process limits per supported OS. Keep admission policy separate from enforcement evidence.
4. **Lifecycle and observability:** monitor each workload separately; respect owner pause, device sleep, battery, thermal state, network changes and shutdown.
5. **LAN publishing:** add only after authentication, request validation, isolation and owner-visible exposure controls are reviewed.
6. **Public access:** treat direct inbound networking and relay/tunnel access as separate options. ISP restrictions, CGNAT, router configuration, TLS and DNS must be assessed; do not imply universal reachability.
7. **Android:** build a native lifecycle/resource integration and validate foreground-service, background-execution and battery constraints before claiming reliable hosting.
8. **iOS:** conduct a native feasibility review first. App lifecycle and background execution restrictions mean persistent general-purpose hosting cannot be assumed.

## Safety and cost boundary

All current listeners remain on loopback. No public activation, DNS/firewall changes, paid infrastructure, hardware purchases or production deployment are authorized by this implementation. The device must remain powered, awake and connected for any hosted service to be reachable. The owner must have visible pause/stop controls and explicit control over resource use.

## Capability detector

The platform-capabilities module reports a conservative, descriptive capability snapshot. It is not an OS probe, installer, enforcement layer or guarantee that a particular device can host reliably. Android detection uses common environment markers and is intentionally labelled experimental.
