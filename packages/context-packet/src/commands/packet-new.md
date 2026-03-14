---
description: Start a new context packet for focused problem-solving
argument-hint: <packet-name>
allowed-tools: [Bash, Read]
---

Start a new context packet for structured problem-solving.

1. Seed the packet: `.claude/bin/packet seed --name $ARGUMENTS`
2. Ask the user: "What problem are you solving?" Get a clear description of the current state, target state, and proposed approach.
3. Create the primary problem vector with their answer:
   ```
   .claude/bin/packet vector update primary --current "<current>" --target "<target>" --approach "<approach>"
   ```
4. Read the materialized packet at `.context/packets/active/$ARGUMENTS.md` to confirm it was created.
5. Explain the workflow: use `/packet-logic` for reasoning passes (no code), `/packet-review` for review gates, and update nodes/vectors as you work.
