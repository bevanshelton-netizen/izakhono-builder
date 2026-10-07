# Security

This package is a control-plane foundation, not a public production deployment by itself.

Before internet exposure:

- set a strong `MEDIA_ADMIN_TOKEN` via the owned secret store;
- terminate TLS at the owned reverse proxy/load balancer;
- replace development `authInternalUsers` with JWT or HTTP authorization;
- restrict MediaMTX control API and metrics to the private network;
- rotate stream keys on suspected compromise;
- back up channel metadata and audit logs;
- enforce storage quotas and media-type validation;
- add rate limits to provisioning endpoints.
