# NODE ENGINE resource governance v1

## Owner-controlled defaults

The prototype defines a conservative balanced policy: 512 MiB requested-memory budget, 25% target CPU budget, 1 GiB workload disk budget, pause on battery, pause on thermal warning, and honour an owner pause request. These values are policy inputs, not measurements or enforced OS limits.

## Admission contract

 `validateResourcePolicy()` rejects malformed or out-of-range policies.  `evaluateWorkloadAdmission()`  blocks new work when the owner has paused hosting, a configured device safety condition applies, or the workload's declared memory request exceeds the configured budget.

## Critical limitation

This milestone implements admission control only. It does not yet measure or enforce CPU, memory, disk I/O, network or thermal limits at the operating-system level. Do not describe these values as hard quotas. Before managed workloads are enabled, each platform adapter must implement and test real OS-level resource controls, process supervision, safe shutdown and recovery.

## Mobile policy

Mobile adapters must additionally observe platform battery/thermal signals where the OS exposes them, and must tolerate background suspension. Android and iOS are separate engineering tracks; desktop behavior must not be assumed to transfer directly.
