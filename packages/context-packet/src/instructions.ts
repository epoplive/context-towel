// ============================================================================
// AI Workflow Instructions — Tells the AI how to use the AICCL packet system
// ============================================================================

/**
 * Core instruction content that teaches the AI the AICCL packet workflow.
 * This gets included in CLAUDE.md when a packet is active.
 */
export const PACKET_WORKFLOW_INSTRUCTIONS = `## Packet Workflow (AICCL Engine)

You have an active context packet. Follow this workflow exactly.

### 1. Read the Materialized Packet

The file at \`.context/packets/active/<packet-name>.md\` contains all context:
whiteboard diagrams, problem vectors, AICCL nodes, and the delta log.
Read it first. Everything you need to understand the problem state is there.

### 2. Mutate via CLI Only

**NEVER edit packet markdown files directly.** All mutations go through the \`packet\` CLI:

\`\`\`bash
# Update or create an AICCL node
packet node update <id> --state active --content "..."

# Promote a node to proven (collapses delta chain into keyframe)
packet node promote <id>

# Mark a node as failed with what was tried and why
packet node fail <id> --tried "..." --reason "..."

# Update a problem vector
packet vector update <id> --current "..." --target "..." --approach "..."

# Update a whiteboard diagram section
packet whiteboard update --section <name> --content "..."

# Append a delta log entry
packet delta append --node <id> --type discovery --content "..."
\`\`\`

The CLI writes to the packet database and re-materializes the markdown.
Editing the file directly will be overwritten on the next mutation.

### 3. Logic Pass First

Before writing any code, work the problem on the whiteboard and in AICCL nodes:

1. **Read** the current packet state (vectors, nodes, whiteboard)
2. **Reason** in AICCL notation -- update whiteboard diagrams, create/update nodes
3. **Express relational mechanics**, not surface descriptions
4. **No implementation during the logic pass** -- this is pure problem-solving

AICCL encoding guidelines:
- Use \`~~~node\` blocks with YAML header + body for structured reasoning
- Use map blocks (\`~~~node-map\`) for symbol compression (e.g., \`a]auth b]api\`)
- Use XML-like \`<comp:name>\` containers for semantic scoping
- Use zoom layers (\`continent\` / \`region\` / \`district\` / \`street\` / \`ground\`) appropriate to problem level
- Express relationships: \`req -> validate(token) -> session | fail\`
- Use arrows for flow: \`->\`, \`<-\`, \`<->\`
- Use logical operators: \`for-all\`, \`exists\`, \`in\`, \`and\`, \`or\`, \`not\`
- Use state markers: \`[ok]\` (proven), \`[dead]\` (dead path), \`[fail]\` (failure)

### 4. Review Gate

Present your logic-pass results to the user before implementing:
- Show updated whiteboard diagrams
- Show AICCL nodes with your reasoning
- Show updated problem vectors
- Ask for approval to proceed to implementation

**Do not skip this step.** The user reviews the logic before code is written.

### 5. Implementation Pass

After logic approval, write code against an already-solved problem:
- The AICCL nodes describe what to build and why
- The whiteboard diagrams show the architecture
- The problem vectors define current state and target state
- You are translating proven logic into code, not exploring

### 6. Packet Update

After implementation, update the packet to reflect new state:

\`\`\`bash
# Update vector to reflect progress
packet vector update <id> --current "implemented X" --target "..." --approach "..."

# Record what was done
packet delta append --node <id> --type success --content "implemented feature X"
\`\`\`

### 7. Failure Annotations

When an approach fails, record it so future sessions don't retrace dead paths:

\`\`\`bash
packet node fail <id> --tried "passport.js middleware" --reason "too much magic, implicit state"
\`\`\`

In AICCL body, prefix failed approaches with \`[dead]\`:
\`\`\`
[dead] passport.js -- implicit state, session coupling
[dead] jose library -- no esm support in target env
\`\`\`

Future sessions see the delta log and dead paths. They skip what already failed.

### 8. Success Promotion

When a problem node resolves:

\`\`\`bash
packet node promote <id>
\`\`\`

This collapses the noisy investigation delta chain into a tight keyframe.
In AICCL body, prefix proven approaches with \`[ok]\`:
\`\`\`
[ok] custom jwt middleware -> stateless, explicit, testable
[ok] zod schemas at boundary -> runtime validation, type inference
\`\`\``

/**
 * Generate the workflow instructions section for inclusion in CLAUDE.md.
 * Only included when a packet is active.
 */
export function generateWorkflowSection(): string {
  return PACKET_WORKFLOW_INSTRUCTIONS
}
