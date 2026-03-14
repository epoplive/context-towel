---
description: Record a failed approach so future sessions skip it
argument-hint: <node-id>
allowed-tools: [Bash, Read]
---

Record a failed approach. This is critical — future sessions and context compactions will see this failure and skip the dead path.

1. Read the current state: `.claude/bin/packet context`
2. Ask the user (or determine from context): "What was tried?" and "Why did it fail?"
3. Record the failure:
   ```
   .claude/bin/packet node fail $ARGUMENTS --tried "<what was attempted>" --reason "<why it failed>"
   ```
4. Read the updated packet to confirm the failure was recorded.
5. Suggest next steps: try a different approach, update the problem vector, or refine the strategy.
