# Resource enforcement and isolation preflight

## What this milestone does

The resource-enforcement module introduces a read-only preflight contract. On Linux it can be supplied with a probe for cgroup v2 mount/controller availability: cpu, memory, io and pids. It reports detection only. A mounted hierarchy and visible controllers do not prove that this process can safely create delegated cgroups, configure limits or contain a process.

Windows Job Objects and macOS resource-control mechanisms are identified as future adapters, not implemented capabilities.

## Fail-closed workload gate

A managed workload must satisfy all three independent conditions:

1. Owner resource policy permits the requested workload.
2. A platform adapter reports verified OS-level resource enforcement.
3. A workload isolation adapter reports verified isolation.

If any condition is missing, the gate denies launch. The current prototype exposes no arbitrary workload launcher, and the gate's executionEnabled field remains false even in a synthetic all-green test. This is a contract and test seam, not an execution feature.

## Explicit non-actions

The preflight does not write to /sys/fs/cgroup, create or modify cgroups, change ownership or permissions, launch processes, create Windows Job Objects, invoke sandbox tools, or change host configuration. It does not claim resource limits are active.

## Before implementing enforcement

- Define a per-workload cgroup delegation model and confirm the host administrator intentionally delegated the subtree.
- Apply CPU quota, memory max/high, pids max and I/O controls to a dedicated workload cgroup.
- Verify effective values by reading kernel-reported settings after application.
- Ensure the workload process is placed in the cgroup before it executes untrusted code (no launch-before-containment race).
- Implement cleanup, crash recovery, owner stop, and limits on aggregate disk usage.
- Add a separate isolation boundary (least-privilege identity, filesystem/network restrictions, syscall policy where available).
- Test on disposable VMs across supported kernel versions and distributions.
- Implement equivalent reviewed Windows and macOS adapters before claiming parity.

No system mutation, public exposure or production workload execution is part of this milestone.
