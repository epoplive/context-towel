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

export const FRAMEWORK_START_MARKER = '<!-- LOOKING_GLASS_FRAMEWORK_START -->'
export const FRAMEWORK_END_MARKER = '<!-- LOOKING_GLASS_FRAMEWORK_END -->'
