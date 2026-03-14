---
description: Review gate — present reasoning for approval before coding
allowed-tools: [Bash, Read]
---

Present a review gate for the active packet's logic pass.

1. Read the full packet state: `.claude/bin/packet context` then read `.context/packets/active/<name>.md`.
2. Present a structured summary to the user:
   - **Problem Vectors**: current state, target, and approach for each
   - **Whiteboard**: key diagrams and architecture decisions
   - **AICCL Nodes**: reasoning nodes with their states (active, success, failed)
   - **Dead Paths**: approaches that were tried and failed (important — these prevent rework)
   - **Proposed Implementation**: what you plan to build based on the logic pass
3. Ask the user explicitly: "Does this reasoning look correct? Should I proceed to implementation?"
4. **Do NOT start coding until the user approves.** This gate exists to catch wrong assumptions before they become wrong code.
5. If the user has feedback, update the relevant nodes/vectors and re-present.
