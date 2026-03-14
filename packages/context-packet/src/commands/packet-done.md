---
description: Promote a packet node to success
argument-hint: <node-id>
allowed-tools: [Bash, Read]
---

Promote a packet node to success — this approach is proven and working.

1. Read the current state: `.claude/bin/packet context`
2. Promote the node: `.claude/bin/packet node promote $ARGUMENTS`
3. Record what was proven with a success delta:
   ```
   .claude/bin/packet delta append --node $ARGUMENTS --type success --content "<what was proven and why it works>"
   ```
4. Check if any problem vectors should be updated to reflect progress:
   ```
   .claude/bin/packet vector update <id> --current "<new current state>" --target "<target>" --approach "<approach>"
   ```
5. Read the updated packet to confirm and summarize what was accomplished.
