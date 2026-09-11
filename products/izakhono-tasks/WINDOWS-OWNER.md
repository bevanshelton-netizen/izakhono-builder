# IZAKHONO TASKS — Windows Owner Node

This is the one-click Windows owner build for IZAKHONO TASKS.

It installs itself under:

`%LOCALAPPDATA%\IzakhonoTasks\IZAKHONO-TASKS.exe`

and creates a Windows Startup launcher so the scheduler comes back after login.

The local dashboard opens at:

`http://127.0.0.1:9991`

## What this removes

IZAKHONO TASKS has **no artificial active-task count cap**. The CI suite explicitly creates more than five concurrent active tasks.

## What it does not yet replace

The scheduler is the timing/control layer. General web research, Gmail monitoring, external app actions and AI condition evaluation require an IZAKHONO owner runner/connector for those capabilities.

Until those connectors are deployed, do not claim full feature parity with ChatGPT Tasks.

## Owner-node proof

The Windows executable writes:

`%LOCALAPPDATA%\IzakhonoTasks\owner-node-proof.json`

This records that the owner scheduler is running and that the software has no artificial task-count ceiling.
