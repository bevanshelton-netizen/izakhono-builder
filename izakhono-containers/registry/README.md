# IZAKHONO Registry authentication

The registry is configured for Docker Registry `htpasswd` authentication.

Create the credentials file before production startup:

```bash
mkdir -p registry/auth
docker run --rm --entrypoint htpasswd httpd:2 -Bbn izakhono-admin "STRONG-PASSWORD" > registry/auth/htpasswd
chmod 600 registry/auth/htpasswd
```

Then start the stack and authenticate:

```bash
docker compose up -d --build
docker login localhost:5000
```

Do not commit the generated `registry/auth/htpasswd` file.
