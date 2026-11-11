# FORTRESS Security Operations Dashboard v1

The dashboard aggregates authorized scan history into a tenant-scoped operational view.

It exposes current risk score, improving/stable/worsening trend, asset and scan counts, finding severity, remediation lifecycle counts, recent scans, and an integrity hash.

The dashboard is an application data model, not a claim of a deployed production UI. A future IZAKHONO-owned control-plane UI can consume this contract.

Safety boundary: FORTRESS remains defensive-only and requires authorized scope. No exploit execution, credential attacks, destructive testing, persistence, or unauthorized discovery.
