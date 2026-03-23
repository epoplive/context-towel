---
description: Archive the active packet and extract patterns
allowed-tools: [Bash, Read]
---

Archive the active packet. This extracts proven patterns and stores the final state.

1. Read the current packet state: `.claude/bin/packet context` then read the full file.
2. Present a summary of what was accomplished:
   - Resolved vectors
   - Successful nodes (these become reusable patterns)
   - Failed approaches (preserved as institutional knowledge)
3. Run the archive: `.claude/bin/packet archive <packet-name>`
4. The archived packet is now at `.context/packets/archive/<name>.md`. Successful nodes are extracted as patterns and will be pre-seeded into future packets.
5. Report what was learned and what patterns were extracted.
