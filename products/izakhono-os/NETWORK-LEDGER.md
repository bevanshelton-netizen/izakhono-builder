# IZAKHONO OS Network Ledger

This file is intentionally human-readable.

A release is not privacy-approved until all IZAKHONO-controlled outbound network activity is listed here.

| Component | Destination | Purpose | Optional | Default |
|---|---|---|---|---|
| IZAKHONO telemetry | none | prohibited | n/a | disabled/nonexistent |
| Ask IZAKHONO cloud AI | none in Alpha | no cloud AI in Alpha | n/a | disabled |
| Debian package manager | configured Debian mirrors | user/system software updates | yes* | network idle until used |
| Firefox ESR | sites chosen by user | web browsing | yes | user initiated |
| fwupd | configured firmware metadata/remotes | firmware availability/update | yes | user controlled |

\* Security maintenance requires a package source when the user chooses to update. IZAKHONO does not add behavioural analytics to update checks.

Any new IZAKHONO endpoint must be added here before release.
