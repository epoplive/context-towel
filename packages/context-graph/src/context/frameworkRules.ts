// ============================================================================
// Framework Rules - Work planning methodology for AI agents
// ============================================================================

export const FRAMEWORK_RULES = `
## Work Planning Framework

**Method:** Divide and conquer via hierarchical decomposition

### Core Approach
1. **Decompose** - Break work into independent sub-items
2. **Delegate** - Each item becomes a focused task
3. **Integrate** - Combine solutions back up the tree

### Task Format
Tasks use fenced code blocks with \`task\` language. Markdown supports both backtick and tilde fences.
Prefer \`~~~task\` when the block body contains literal backtick-only fence lines (common inside \`description: |\`).

~~~~markdown
~~~task
id: task-id           # recommended for stable links + Claude sync
# If omitted, LG generates <file-prefix>__<slug> (implicit id)
title: Feature Name
status: todo
priority: high
tags: #tag1 #tag2     # alias: labels
category: platform
owner: brett
active-form: Building feature
blocked-by: [[other-task]]
blocks: [[downstream-task]]
description: |
  What needs to be solved.
checklist:
  - [ ] Step 1
  - [ ] Step 2
  - [x] Completed step
log:
  - [2026-01-25] Started implementation
notes: |
  Implementation notes.
~~~
~~~~

**Fields:** id, title, status (todo|in-progress|done|blocked), priority (low|medium|high|critical), tags/labels, category, owner, active-form, blocked-by, blocks, description, checklist, log, notes

**Sync:** Task blocks in \`.context/working\` are the source of truth and auto-sync into Claude tasks (\`~/.claude/tasks/<project-list-id>\`). Use \`id\` for stable mapping.

### Critical Rules
1. **Search before create** - Find existing patterns/code first
2. **Minimize file count** - One file per concept, no fragmentation
3. **Single source of truth** - Each piece of data lives in one place
4. **Leaf items first** - Work on the most specific items
5. **Log your work** - Every action gets a log entry

## Workspace Folder Structure
These folders are configured in Project Settings and can live anywhere on disk.
| Directory | Purpose |
|-----------|---------|
| docs/ | Stable reference (architecture, systems) |
| working/ | Active focus (current work, tasks) |
| archive/ | Completed work (out of sight) |
`.trim()

/**
 * Codebase index documentation format — teaches agents the entity registry system.
 * This format creates a shared symbol table for documentation: short IDs that
 * cross-reference code, systems, interfaces, problems, pipelines, and docs.
 */
export const INDEX_FORMAT_RULES = `
## Codebase Index Format

When documenting a codebase, use \`\`\`index blocks to create a shared symbol table.
Entity IDs form a linking namespace — everything cross-references by short ID.

### Format

\`\`\`\`markdown
\`\`\`index
# FILE_PATHS
F1:src/auth/token.ts
F2:src/auth/session.ts

# SYSTEMS
S1:AUTH_SYSTEM|Authentication and session management|
F1>42-60:Token validation
F2>10-30:Session store

# CRITICAL_INTERFACES
I1:AUTH_REQUEST|Authenticated request type|
F1>5-20:Type definition

# PROBLEM_AREAS
P1:TOKEN_EXPIRY|Tokens not refreshing|
F1>100-120:Expiry check@CODE@

# PIPELINE_FLOWS
PF1:AUTH_FLOW|F1>Validate token>F2>Check session>F1>Return user

# CODE_SNIPPETS
CS1:TOKEN_CHECK|Core validation logic|
F1>42-60:@CODE@

# CONTEXT_LINKS
CL1:AUTH_FULL|
S1:AUTH_SYSTEM
I1:AUTH_REQUEST
P1:TOKEN_EXPIRY
PF1:AUTH_FLOW
\`\`\`
\`\`\`\`

### Entity ID Conventions
| Prefix | Type | Example |
|--------|------|---------|
| F | File path | F1:src/auth/token.ts |
| S | System/module | S1:AUTH_SYSTEM |
| I | Interface/boundary | I1:AUTH_REQUEST |
| P | Problem area | P1:TOKEN_EXPIRY |
| PF | Pipeline flow | PF1:AUTH_FLOW |
| CS | Code snippet | CS1:TOKEN_CHECK |
| DS | Doc section | DS1:ARCH_OVERVIEW |
| CL | Context link | CL1:AUTH_FULL |

### File References
- \`F1>42-60\` — lines 42-60 of file F1
- \`F1>42-60:Description\` — with human label
- \`F1>42-60:@CODE@\` — expandable to show actual code
- \`F1>42-60:@MARKDOWN@\` — expandable to show rendered docs

### Context Links
CL entries connect entities across types. When you reference a concept, the context
link tells you everything related: which systems, interfaces, problems, and flows
are involved.

### When to Create/Update Indexes
- **Exploring a codebase**: Build the index as you discover systems and boundaries
- **During code review**: Update the index with new entities found
- **After refactoring**: Update file paths and line ranges
- **In .context/docs/**: Store stable indexes alongside architecture docs
`.trim()

/**
 * Canary verification instructions — teaches agents about the verification symbol system.
 */
export const CANARY_VERIFICATION_RULES = `
## Verification Symbols

This project uses canary verification symbols to prove you correctly read and resolved
linked files. When a verification section is present in this file, each contract has
a symbol that reflects which files were loaded.

### How It Works
- Each contract (index, packet, docs) has a symbol
- Sub-files may override the base symbol via \`<!-- canary:NAME=SYMBOL -->\` comments
- If you read the sub-file, you see the overridden symbol
- Echo the symbol from the **last file you read** — that's the correct one

### When Asked to Verify
If asked to verify context resolution, echo back the symbols from the Verification
Symbols section. The human can then confirm you correctly resolved the file chain.

### Override Precedence
Sub-files override the main file's symbol. If multiple sub-files override the same
contract, the last one loaded wins. This tests whether your context resolution
follows the correct precedence order.
`.trim()

/**
 * Pattern reference system — categorized IDs for documentation cross-referencing.
 * Complements entity IDs (F1, S1) which reference code locations — pattern IDs
 * reference documentation patterns, implementation blocks, and verification artifacts.
 */
export const PATTERN_REFERENCE_RULES = `
## Pattern References

Documentation uses categorized reference IDs for cross-linking patterns and implementations.

### Pattern Categories
| Prefix | Category | Purpose |
|--------|----------|---------|
| CP-NN | Core Pattern | Fundamental design patterns (e.g., CP-01: Repository Pattern) |
| IP-NN | Interface Pattern | Interface design/usage patterns (e.g., IP-01: Adapter Interface) |
| CM-NN | Component Pattern | Component implementation patterns (e.g., CM-01: Provider Pattern) |
| TP-NN | Testing Pattern | Testing approaches (e.g., TP-01: Integration Test Pattern) |
| IRB-NN | Implementation Reference Block | Reusable code patterns with concrete examples |

### Document Reference Types
| Prefix | Type | Purpose |
|--------|------|---------|
| IA-NNN | Impact Analysis | Documents analyzing change impact |
| CV-NNN | Cross-Verification | Documents verifying consistency |
| OR-NNN | Original | Original plans/specs (never modified) |
| UF-NNN | Unfinished | Active work-in-progress documents |

### Pattern-to-Architecture Mapping
- Each pattern references the entity IDs it applies to: \`CP-01 applies to S1, S3, S5\`
- Implementation reference blocks include concrete code from entity refs: \`IRB-01 demonstrates CP-01 via CS3\`
- Cross-verification tables check: does the code match the documented pattern?

### When to Create Pattern References
- **During code review**: identify recurring patterns, assign [CP-NN] IDs
- **During architecture docs**: document interface patterns with [IP-NN]
- **After implementation**: create [IRB-NN] blocks linking pattern to actual code
- **Cross-reference with entity IDs**: [CP-01] applies to S1:AUTH_SYSTEM means the auth system uses the repository pattern
`.trim()

/**
 * Document lifecycle workflow — maps the three-folder document lifecycle to .context/ structure.
 * Teaches agents how to create, update, and manage documentation alongside code changes.
 */
export const DOC_LIFECYCLE_RULES = `
## Documentation Lifecycle

Documentation follows a structured lifecycle through the .context/ folder structure.

### Folder Mapping
| Folder | Lifecycle Stage | Description |
|--------|----------------|-------------|
| .context/docs/ | Stable reference | Finished documentation — architecture, systems, indexes |
| .context/working/ | Active development | Work-in-progress — plans, tasks, active investigations |
| .context/archive/ | Completed work | Out of active view — past plans, resolved investigations |

### Document Update Process
1. **Identify need** — code changed, new system discovered, pattern emerged
2. **Check existing docs** — search .context/docs/ for related documentation
3. **Create or update** — work in .context/working/ for active changes
4. **Update cross-references** — entity IDs, pattern refs, context links
5. **Update codebase index** — reflect new/changed file paths and line ranges
6. **Promote to stable** — move finished docs to .context/docs/

### Status Indicators
Use these in document headers or section markers:
- \`[in-progress]\` — actively being updated
- \`[complete]\` — finished, ready for reference
- \`[planned]\` — identified but not started
- \`[needs-testing]\` — implementation exists, needs verification
- \`[has-issues]\` — known problems documented inline
- \`[needs-docs]\` — code exists without documentation

### Progressive Summarization
As documentation matures, compress through levels:
1. **Raw details** — full investigation notes, all context (in working/)
2. **Working summary** — key findings and decisions (in working/)
3. **Architecture overview** — stable patterns and boundaries (in docs/)
4. **Index entry** — entity IDs and cross-references (in docs/index)

### Cross-Reference Maintenance
When updating documentation:
- Update any entity IDs whose file paths or line ranges changed
- Update pattern references if the pattern evolved
- Update context links if new connections were discovered
- Flag stale cross-references for review rather than deleting them
`.trim()

/**
 * Documentation-code conflict resolution — defines strategies when docs and code diverge.
 * Integrates with the staleness detection system.
 */
export const CONFLICT_RESOLUTION_RULES = `
## Documentation-Code Conflict Resolution

When documentation and code diverge, use these resolution strategies.

### Conflict Types
| Type | Detection | Example |
|------|-----------|---------|
| Structure | File moved/renamed/deleted | F1 path no longer exists |
| Range | Line numbers shifted | F1>42-60 now contains different code |
| Logic | Behavior changed | Documented pattern no longer matches implementation |
| Pattern | Architecture evolved | CP-01 no longer describes the actual pattern used |

### Resolution Strategies
| Strategy | When to Use | Action |
|----------|------------|--------|
| implementation_wins | Code refactored, docs stale | Regenerate docs from current code |
| docs_wins | Contract-first design, code is wrong | Fix code to match documented contract |
| manual_merge | Ambiguous divergence | Flag for human review, preserve both versions |

### Automatic Resolution
These conflicts resolve automatically:
- **File renames**: update F-ID paths when git detects renames
- **Line shifts**: recompute ranges from content hashing (find moved content)
- **New files**: add to FILE_PATHS section, assign next available F-ID

### Semi-Automatic Resolution
These require confirmation:
- **Content changed**: flag stale references, regenerate on next review cycle
- **System boundaries moved**: suggest index updates, human confirms
- **Interface evolved**: flag pattern references for review

### Manual Resolution Required
These need human judgment:
- **Architecture restructure**: new systems replace old ones
- **Conflicting documentation**: multiple docs describe same thing differently
- **Deprecated patterns**: old pattern refs point to removed code

### Process
1. Run staleness detection: \`checkStaleness(registry, reader)\`
2. Categorize each stale reference by conflict type
3. Apply resolution strategy per type
4. Log what changed in the document's update history
5. Flag unresolvable conflicts for human review
`.trim()

export const FRAMEWORK_START_MARKER = '<!-- LOOKING_GLASS_FRAMEWORK_START -->'
export const FRAMEWORK_END_MARKER = '<!-- LOOKING_GLASS_FRAMEWORK_END -->'
