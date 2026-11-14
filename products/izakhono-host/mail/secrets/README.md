# Local Roundcube secrets

This directory is intentionally excluded from Git.

Create the following files on the owner-controlled host before starting the host stack:

- roundcube_db_password: a unique random password used only by the Roundcube PostgreSQL database.
- roundcube_des_key: a unique random encryption key for Roundcube.
- mail_admin_password: generated owner-only Basic Auth password for https://mail-admin.izakhonoafrica.co.za. The bcrypt hash is stored in the host .env.

Use owner-only file permissions (chmod 600). Do not reuse the Stalwart administrator password, SMTP mailbox password, Supabase credentials, or the host runtime token.

Example generation commands:

    umask 077
    openssl rand -base64 48 > roundcube_db_password
    openssl rand -base64 32 > roundcube_des_key
    chmod 600 roundcube_db_password roundcube_des_key

The Docker Compose secrets mount the Roundcube files read-only into the Roundcube and database containers. Keep mail_admin_password owner-only and never send it by email or commit it to source control.
