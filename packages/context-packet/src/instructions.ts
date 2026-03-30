// ============================================================================
// AI Workflow Instructions — Teaches the AI the packet workflow
// ============================================================================

/**
 * Core instruction content that teaches the AI the packet workflow.
 * This gets included in CLAUDE.md when a packet is active.
 */
export const PACKET_WORKFLOW_INSTRUCTIONS = `## Packet Workflow

You have an active context packet. The packet is your working memory — structured
knowledge that survives when the context window fills. Your job is to research,
reason, implement, and update the packet as you go.

### Rules

1. **NEVER edit packet markdown files directly.** All mutations go through the \`packet\` CLI.
2. **Follow the phases in order.** Research → Logic → Implement → Update.
3. **Think before coding.** Define the problem vectors before writing implementation code.

### CLI Reference

\`\`\`bash
# Nodes
packet node update <id> --state active --content "<description>"
packet node promote <id>
packet node fail <id> --tried "<what>" --reason "<why>"

# Vectors
packet vector update <id> --current "<state>" --target "<goal>" --approach "<strategy>"
packet vector resolve <id>
packet vector criterion add <vecId> --text "<criterion>" [--type solved|fact] [--mark <mark>]
packet vector criterion update <vecId> <index> --mark <proven|pending|failed>

# Whiteboard
packet whiteboard update --section <name> --content "<mermaid>"

# Deltas
packet delta append --node <id> --type <discovery|reasoning|success|failure> --content "<text>"

# Edges
packet edge add <source> <target>
packet edge remove <source> <target>

# Documents
packet doc create <path> [--node <id>] [--content <text>]
packet doc read <path>
packet doc link <path> --node <id>

# Attach typed nodes
packet attach <work-node> --ref <path>
packet attach <work-node> --test <path>
packet attach <work-node> --diagram <mermaid>
\`\`\`

### Phase 1: RESEARCH

Understand the problem. Explore the codebase, read relevant files, and capture
what you learn as packet nodes and deltas.

- Create nodes for key findings: \`packet node update <id> --state active --content "<finding>"\`
- Use the whiteboard for architectural diagrams: \`packet whiteboard update --section <name> --content "<mermaid>"\`
- Attach reference files to work nodes: \`packet attach <work-node> --ref <path>\`
- Log discoveries: \`packet delta append --node <id> --type discovery --content "<what you found>"\`

### Phase 2: LOGIC

Define the problem abstractly before coding. Use problem vectors to capture
current state, target state, and approach.

- Define vectors: \`packet vector update <id> --current "<state>" --target "<goal>" --approach "<strategy>"\`
- Add verifiable criteria: \`packet vector criterion add <vecId> --text "<criterion>" --type solved\`
- Add established facts: \`packet vector criterion add <vecId> --text "<fact>" --type fact --mark established\`
- Identify gaps: \`packet vector criterion add <vecId> --text "<gap>" --type fact --mark gap\`

Each criterion must be independently verifiable — "Does this hold?" has a yes/no answer.

Present the problem definition to the user before implementing.

### Phase 3: IMPLEMENT

Translate the logical solution to code. The problem is already defined —
you are writing code that satisfies the criteria.

- Read only the files your reference nodes point to
- Log progress: \`packet delta append --node <id> --type success --content "<what worked>"\`
- Log failures: \`packet node fail <id> --tried "<approach>" --reason "<why it failed>"\`

### Phase 4: UPDATE

Collapse knowledge on completion:
- Promote resolved nodes: \`packet node promote <id>\`
- Update criteria marks: \`packet vector criterion update <vecId> <index> --mark proven\`
- Update vectors to reflect new state
- Resolve completed vectors: \`packet vector resolve <id>\`

### Failure Annotations

When an approach fails, record it so future sessions skip dead paths:
\`\`\`bash
packet node fail <id> --tried "approach name" --reason "why it failed"
\`\`\`

### Entity References in Packets

When a \`.context/docs/\` index exists, reference entities by ID in packet nodes:
- Systems: "This touches S1:AUTH_SYSTEM"
- Files: "Changed F1>42-60" in delta log
- Pipelines: "Affects PF1:AUTH_FLOW"

The packet links to the index. The index links to the code. Agent navigates precisely.`

/**
 * Generate the workflow instructions section for inclusion in CLAUDE.md.
 * Only included when a packet is active.
 */
export function generateWorkflowSection(): string {
  return PACKET_WORKFLOW_INSTRUCTIONS
}
