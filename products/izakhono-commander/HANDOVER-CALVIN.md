# IZAKHONO COMMANDER — CALVIN HANDOVER

## Handover gate

This package is intended only for computers that Calvin and the operator explicitly authorize.

### Required before production handover
- [ ] Server deployed behind HTTPS/WSS
- [ ] Device paired with a one-use pairing code
- [ ] Device token stored outside source control
- [ ] Operator session authenticated
- [ ] Graphical session expires automatically
- [ ] Local agent shows an active-session indicator
- [ ] Local stop control terminates the session
- [ ] Screen frames are transmitted only during an authorized session
- [ ] Mouse/keyboard events are accepted only from the authorized session
- [ ] Clipboard and file transfer remain disabled by default
- [ ] Session start/stop and privileged input events are audited
- [ ] Windows/Linux/macOS agent package is built and smoke-tested

## Ownership

Customer: !XQWAXQWAMILÉ HOLDINGS (PTY) LTD
Primary owner/operator handover: Calvin Delport
Platform: IZAKHONO COMMANDER

## Security rule

Never place administrator secrets, agent tokens, or private keys in Git, browser source, screenshots, or handover documentation.

## Status

The graphical control-plane and native capture/input foundations exist. The live transport and production verification remain release-gate items until they have been exercised end-to-end on an authorized machine.
