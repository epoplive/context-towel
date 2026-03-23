// ============================================================================
// AI Workflow Instructions — Teaches the AI the AICCL compilation pipeline
// ============================================================================

/**
 * Core instruction content that teaches the AI the AICCL packet workflow.
 * This gets included in CLAUDE.md when a packet is active.
 */
export const PACKET_WORKFLOW_INSTRUCTIONS = `## Packet Workflow (AICCL Compilation Pipeline)

You have an active context packet. The packet is your working memory — compressed
knowledge that survives when the context window fills. Your job is to COMPILE the
user's problem into AICCL, then SOLVE from the compiled representation.

### Rules

1. **NEVER edit packet markdown files directly.** All mutations go through the \`packet\` CLI.
2. **Use AICCL notation, not plain English.** Express relational mechanics, not descriptions.
3. **Follow the phases in order.** Compile → Verify → Solve → Implement → Update.
4. **Compile before solving.** Don't jump to implementation. Build the proof board first.

### CLI Reference

\`\`\`bash
# Nodes
packet node update <id> --state active --layer <zoom> --content "<AICCL>"
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

# Compilation
packet compile status
packet compile verify
\`\`\`

### Phase 1: COMPILE (replaces Research + Plan)

Transform the user's problem description into structured AICCL:

**Step 1 — Build compression maps** for the domain:
\`\`\`
<comp:map:auth>
🔐=auth  🎫=jwt  👤=user  🏠=session  🔑=refresh
M=middleware  V=validate  R=route
</comp:map:auth>
\`\`\`
Identify recurring concepts. Assign symbols. Use emoji for domain objects,
single letters for frequent operations.

**Step 2 — Decompose SOLVED STATE** into verifiable criteria:
\`\`\`bash
packet vector criterion add primary --text "Stateless auth — no session table dependency" --type solved
packet vector criterion add primary --text "Token refresh without user interaction" --type solved
packet vector criterion add primary --text "RBAC enforced at middleware level" --type solved
\`\`\`
Each criterion must be independently verifiable. "Does this criterion hold?" has a yes/no answer.

**Step 3 — Decompose PROBLEM STATE** into established facts and gaps:
\`\`\`bash
packet vector criterion add primary --text "Current auth uses session cookies" --type fact --mark established
packet vector criterion add primary --text "Session table is bottleneck at scale" --type fact --mark gap
\`\`\`

**Step 4 — Create proof steps** connecting gaps to criteria:
\`\`\`bash
packet node update jwt-stateless-proof --state active --layer district \\
  --content "claim: Stateless JWT eliminates session coupling
derives-from: auth-requirements, session-analysis
proves: no-session-coupling, stateless-auth
---
∀ req → V(🎫) → claims | ⊥
🎫 ∈ {access, refresh} — no 🏠 lookup
claims.exp < now → reject (no refresh in hot path)

✓ Eliminates session table dependency
✓ Horizontal scaling: any instance validates any token
💀 passport.js — implicit state, session coupling

files: src/middleware/auth.ts:42"
\`\`\`

**Step 5 — Present compilation to user** for review.

### Worked Example: Plain English → AICCL Compilation

**User says:** "Our auth system uses session cookies and we need to migrate to JWT.
The session table is becoming a bottleneck. We need stateless auth that scales horizontally."

**Compilation:**

1. **Map:** \`<comp:map:auth>🔐=auth 🎫=jwt 👤=user 🏠=session 🔑=refresh M=middleware V=validate</comp:map:auth>\`

2. **Solved criteria:**
   - Stateless auth — no session table dependency
   - Token refresh without user interaction
   - Horizontal scaling — any instance validates

3. **Problem facts:**
   - [established] Current auth uses session cookies (🏠-based)
   - [established] Session table is shared state across instances
   - [gap] 🏠 table is bottleneck at scale
   - [gap] No 🎫 infrastructure exists

4. **Proof step:**
\`\`\`
~~~node
id: jwt-migration-proof
state: active
layer: region
claim: Replace 🏠-based 🔐 with stateless 🎫
derives-from: session-bottleneck-analysis
proves: stateless-auth, horizontal-scaling
---
∀ req → M.V(🎫.access) → claims | ⊥
🎫.exp < now ∧ 🎫.refresh.valid → rotate(🎫) → new_claims
🏠 table: DROP (after migration complete)

Phase: 🏠 → 🎫 (dual-write period) → 🎫 only
files: src/middleware/auth.ts, src/models/session.ts
~~~
\`\`\`

### Phase 2: VERIFY (review gate)

Output a compilation summary:
- N solved criteria (M proven, K pending)
- N problem facts (M established, K gaps)
- N proof steps connecting them

Ask the user: **"Does this capture the problem correctly?"**
The user confirms or corrects. Update AICCL accordingly.
Do NOT proceed to implementation until the user approves the compilation.

### Phase 3: SOLVE LOGIC

Work the problem in AICCL notation. **No code yet.**
Update nodes with relational logic. Create proof steps that derive from
established facts and prove criteria. When a proof step is solid, it
claims something and proves it by chaining from known facts.

Present each proof step to the user before implementing.

### Phase 4: IMPLEMENT

Translate proven AICCL patterns to code. The problem is already solved —
you are translating logic into a specific language/framework.
Surgical file reads only where AICCL file references point.

### Phase 5: UPDATE

Collapse knowledge on completion:
- Promote resolved nodes: \`packet node promote <id>\`
- Update criteria marks: \`packet vector criterion update <vecId> <index> --mark proven\`
- Update vectors to reflect new state
- The collapsed node is a keyframe — tight, proven, reusable by future packets

### Grain Size Guidelines

- **Criterion:** One verifiable claim. "Does X hold?" → yes/no.
  Too big: "Auth works correctly" — not verifiable in isolation.
  Right size: "Token validation rejects expired tokens" — test it.

- **Proof step:** One logical assertion that derives from known things and proves criteria.
  Too big: "Implement the entire auth system" — that's a project, not a step.
  Right size: "Stateless JWT validation eliminates session coupling" — provable.

- **Comp map:** One domain's symbol vocabulary. Don't put everything in one map.
  Use inheritance: base symbols → domain-specific symbols.

### Failure Annotations

When an approach fails, record it as a traversal prohibition:
\`\`\`bash
packet node fail <id> --tried "passport.js" --reason "implicit state, session coupling"
\`\`\`
In AICCL body: \`💀 passport.js — implicit state, session coupling\`
Future sessions see dead paths and skip them.

### Entity References in Packets

When a \`.context/docs/\` index exists, reference entities by ID in packet nodes:
- Systems: "This touches S1:AUTH_SYSTEM"
- Files: "Changed F1>42-60" in delta log
- Pipelines: "Affects PF1:AUTH_FLOW"
- Context: "See CL1:AUTH_FULL for related entities"

In AICCL node bodies, entity IDs ARE compression — \`S1\` replaces the full system description.
Comp map symbols and entity IDs work together: \`🔐=S1:AUTH_SYSTEM\` links the symbol to the index.

The packet links to the index. The index links to the code. Agent navigates precisely.`

/**
 * Generate the workflow instructions section for inclusion in CLAUDE.md.
 * Only included when a packet is active.
 */
export function generateWorkflowSection(): string {
  return PACKET_WORKFLOW_INSTRUCTIONS
}
