# IZAKHONO COMPUTER UI

The next client surface is a portable web desktop backed by NODE01-SW.

## Core panels

- **Desktop:** current workspace, node identity, compute state and active jobs.
- **Files:** safe virtual filesystem rooted inside the selected workspace.
- **Apps:** application registry for CODE, SUPER AI, RUN, DEPLOY and PROVISIONER.
- **Activity:** build/test/run/deploy/provision jobs and their state.
- **Security:** active capabilities and denied privileged operations.

## Design rule

The UI never exposes unrestricted host shell access. Application launch and file operations are capability-bound and must execute through the NODE01-SW control plane.

## Portability

A client should be replaceable without losing workspace state. Compute workers remain adapters behind the control plane, allowing a workspace to survive loss or replacement of a particular machine.
