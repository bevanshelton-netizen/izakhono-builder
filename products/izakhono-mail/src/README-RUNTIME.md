# IZAKHONO MAIL — Runtime Activation

This is the activation boundary for the private `@izakhono` namespace.

## Owner identity

- `bevan@izakhono`
- Password is created interactively on the IZAKHONO node.
- Never commit a password, session token, or relay credential.

## Activation

1. Run the IZAKHONO MAIL Docker Compose stack from this directory.
2. Run the owner bootstrap utility and enter the password interactively.
3. Open the private webmail endpoint exposed by the IZAKHONO node.
4. Sign in as `bevan@izakhono`.
5. Send a message to `bevan@izakhono`.
6. Confirm it appears in Sent and Inbox.
7. Sign out and sign in again.
8. Confirm the message remains available.

## Acceptance gate

The system must not be described as live until the above end-to-end runtime test has passed on an actual Docker-capable IZAKHONO node.

## Namespace boundary

`@izakhono` is currently a private namespace. It is not a public Internet domain and ordinary Gmail/Outlook users cannot resolve it. Public email interoperability belongs to the later Public Bridge stage and requires a publicly resolvable domain/DNS path.

## Security boundary

The bootstrap operation must be local/on-node. Credentials remain outside source control. Authentication uses salted scrypt password hashes and hashed session tokens.
