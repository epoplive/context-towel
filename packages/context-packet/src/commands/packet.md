---
description: Show active packet status
allowed-tools: [Bash, Read]
---

Check the active context packet status.

1. Run `.claude/bin/packet context` to get the compact packet state.
2. If there is an active packet, read the full packet file at `.context/packets/active/<name>.md` for complete context including whiteboard, AICCL nodes, and delta log.
3. Present a clear summary to the user: active vectors, node states, and recent activity.
4. If no active packet exists, let the user know and suggest `/packet-new <name>` to start one.
