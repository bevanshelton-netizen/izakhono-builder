# IZAKHONO HTTPS Recovery Cutover Checklist

## Software-ready

- [x] Recovery API binds to loopback/private network.
- [x] Recovery paths are isolated behind a dedicated public origin.
- [x] Node agent `9191` is not exposed by the recovery proxy.
- [x] Control plane `9292` is not exposed by the recovery proxy.
- [x] Unknown public paths return 404.
- [x] TLS security headers are defined.
- [x] Caddy configuration is validated before reload.
- [x] No certificate or private key is committed to Git.

## Physical activation — still required

- [ ] Choose the real recovery hostname.
- [ ] Create public DNS A/AAAA record to the activated owner host.
- [ ] Allow inbound TCP 80/443 to the Caddy host.
- [ ] Confirm the owner host has the NODE Fabric and recovery service installed.
- [ ] Set `IZAKHONO_ID_PUBLIC_BASE_URL` to the same HTTPS origin.
- [ ] Configure owner-controlled SMTP with `IZAKHONO_ID_EMAIL_MODE=smtp`.
- [ ] Run `install-recovery-proxy.sh` as root with `IZAKHONO_RECOVERY_DOMAIN` set.
- [ ] Verify ACME certificate issuance externally.
- [ ] Verify `https://<domain>/healthz` externally.
- [ ] Verify `https://<domain>/forgot-password` externally.
- [ ] Send a real verification/recovery email and confirm receipt.
- [ ] Complete one end-to-end reset and normal login/MFA test.

Only after all physical checks pass should the service be marked **PUBLIC HTTPS LIVE**.
