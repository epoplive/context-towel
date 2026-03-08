// ============================================================================
// AI Workflow Instructions — Tells the AI how to use the packet system
// ============================================================================

/**
 * Core instruction content that teaches the AI the packet workflow.
 * This gets included in CLAUDE.md when a packet is active.
 */
export const PACKET_WORKFLOW_INSTRUCTIONS = `## Packet Workflow

When a context packet is active, follow this workflow:

### Before Writing Code
1. **Read the packet** — read the packet file (path shown above) for full context
2. **Check the pattern library** — read \`.context/patterns/index.md\` to identify which
   pattern chain fits the domain. Pull the relevant chain file for the standard flow.
3. **Architecture first** — draw/update diagrams before writing implementation.
   Use mermaid in \`~~~diagram\` blocks: ERDs for data models, flowcharts for architecture,
   sequence diagrams for flows, class diagrams for interfaces.
4. **Identify patterns** — map the problem onto known patterns from the library. List them
   in "Patterns Applied" with rationale. Get user approval on patterns before implementing.
5. **Think in logic, not code** — diagrams should be language-agnostic. ERD is the data model,
   not the ORM schema. Sequence diagram is the flow, not the framework middleware.
   Code is the translation step after the logic is approved.

### While Working
6. **Chunk from plan** — pull relevant tasks from the linked plan file into the
   packet's Active Tasks. Don't try to hold the whole plan.
7. **Update as you go** — after completing work, update the packet:
   - Mark completed tasks, add new ones discovered
   - Update diagrams if architecture changed
   - Add session log entries for what was done
   - Record pivots in "Tried & Pivoted" with reasons

### Keep Current
8. **Problem vector** — keep the Problem Vector section current. It should always
   reflect the actual current→target state.
9. **Session log** — append entries for significant decisions, pivots, and milestones.`

/**
 * Generate the workflow instructions section for inclusion in CLAUDE.md.
 * Only included when a packet is active.
 */
export function generateWorkflowSection(): string {
  return PACKET_WORKFLOW_INSTRUCTIONS
}
