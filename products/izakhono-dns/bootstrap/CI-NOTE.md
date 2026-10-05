# CI note

The repository workflow validates shell syntax and hardening markers only. It does not attempt to contact public DNS hosts, because doing so without operator-supplied production addresses would be unsafe and non-deterministic.
