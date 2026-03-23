---
description: Logic pass — reason about the problem before writing code
allowed-tools: [Bash, Read, Glob, Grep]
---

Enter a logic pass on the active packet. This is pure reasoning — NO CODE.

1. Read the active packet: run `.claude/bin/packet context` for summary, then read the full file at the path shown.
2. Study the current state: whiteboard diagrams, problem vectors, AICCL nodes, and delta log. Understand what has been tried and what failed.
3. Reason about the problem using AICCL notation:
   - Update whiteboard diagrams to visualize the architecture or data flow
   - Create or update AICCL nodes with your analysis
   - Express relational mechanics, not surface descriptions
   - Mark dead paths with `[dead]` and proven approaches with `[ok]`
4. Record your reasoning:
   ```
   .claude/bin/packet node update <id> --state active --content "<reasoning>"
   .claude/bin/packet whiteboard update --section <name> --content "<mermaid>"
   ```
5. Update problem vectors if your understanding has changed:
   ```
   .claude/bin/packet vector update <id> --current "<updated>" --target "<refined>" --approach "<new approach>"
   ```
6. **Do NOT write any implementation code during this pass.** This is about understanding and planning, not building.
7. When you've completed your analysis, suggest the user run `/packet-review` to present your reasoning for approval.
