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
Tasks use fenced code blocks with \`task\` language:

\`\`\`\`markdown
\`\`\`task
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
\`\`\`
\`\`\`\`

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

export const FRAMEWORK_START_MARKER = '<!-- LOOKING_GLASS_FRAMEWORK_START -->'
export const FRAMEWORK_END_MARKER = '<!-- LOOKING_GLASS_FRAMEWORK_END -->'
