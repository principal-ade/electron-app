---
id: TASK-3
title: Add pull-based scrollback buffer retrieval for daemon mode
status: To Do
assignee: []
created_date: '2026-03-31 16:44'
labels:
  - terminal
  - daemon
  - enhancement
dependencies: []
references:
  - docs/terminal-buffer-restoration.md
  - >-
    .principal-views/terminal-session-management/terminal-session-management.otel.canvas
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Currently, daemon mode uses the existing push-based scrollback mechanism via the 'attach' message. The new pull-based getTerminalBuffer() returns null for daemon mode. To make daemon mode consistent with legacy mode, we need to:

1. Add a 'get-scrollback' message type to the daemon protocol
2. Handle the async response from the daemon in the worker
3. Wait for the daemon's scrollback response before sending SCROLLBACK_RESPONSE

This would allow the terminal-panel to pull the scrollback buffer deterministically when xterm.js is ready, instead of relying on the push-based attach flow.
<!-- SECTION:DESCRIPTION:END -->
