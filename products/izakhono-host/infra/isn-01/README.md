# ISN-01 physical execution environment

ISN-01 is the currently designated physical machine: Windows 11 with WSL2 Ubuntu 24.04. NODE01 is the logical IZAKHONO software-node identity and remains portable.

Run the bootstrap from the Ubuntu terminal, not Windows PowerShell:

```bash
cd <path-to-repository>/products/izakhono-host
./infra/isn-01/ISN-01-BOOTSTRAP-WSL2.sh
```

If the script enables systemd, restart WSL from PowerShell:

```powershell
wsl --shutdown
```

Reopen Ubuntu, rerun the bootstrap, then execute NODE-PREFLIGHT.sh and NODE01-ACTIVATE.sh.

The bootstrap installs Docker Engine inside Ubuntu, the Compose plugin, Restic, DNS tools and operational utilities. It does not deploy the hosting platform by itself.

WSL2 NAT does not automatically provide stable public ingress. Production mail requires a static public IP, TCP 25 inbound and outbound, PTR control, firewall/Windows/router forwarding and independent external tests. If those cannot be provided reliably, run the public mail edge on a dedicated Linux server under IZAKHONO's control and connect it to the host stack over a private VPN.
