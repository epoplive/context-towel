# context-towel

## Quick Context

**Project:** context-towel
**Path:** /Users/epoplive/context-towel


<!-- LOOKING_GLASS_FRAMEWORK_START -->
## Work Planning Framework

**Method:** Divide and conquer via hierarchical decomposition

### Core Approach
1. **Decompose** - Break work into independent sub-items
2. **Delegate** - Each item becomes a focused task
3. **Integrate** - Combine solutions back up the tree

### Task Format
Tasks use fenced code blocks with `task` language. Markdown supports both backtick and tilde fences.
Prefer `~~~task` when the block body contains literal backtick-only fence lines (common inside `description: |`).

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

**Sync:** Task blocks in `.context/working` are the source of truth and auto-sync into Claude tasks (`~/.claude/tasks/<project-list-id>`). Use `id` for stable mapping.

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
<!-- LOOKING_GLASS_FRAMEWORK_END -->

<!-- LOOKING_GLASS_CURRENT_FOCUS_START -->
## Current Focus

**Mode:** Full graph view

### Open Panels
- `project/.context/working/block-system-plan.md`

*This section is managed by Looking Glass. Edit the source files directly.*
<!-- LOOKING_GLASS_CURRENT_FOCUS_END -->
<!-- FELIX_FRAMEWORK_START -->
## Work Planning Framework

**Method:** Divide and conquer via hierarchical decomposition

### Core Approach
1. **Decompose** - Break work into independent sub-items
2. **Delegate** - Each item becomes a focused task
3. **Integrate** - Combine solutions back up the tree

### Task Format
Tasks use fenced code blocks with `task` language. Markdown supports both backtick and tilde fences.
Prefer `~~~task` when the block body contains literal backtick-only fence lines (common inside `description: |`).

~~~~markdown
~~~task
id: task-id           # recommended for stable links + Claude sync
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

**Sync:** Task blocks in `.context/working` are the source of truth and auto-sync into Claude tasks.

### Plan File Format
Plans use `## Phase N: Name` headers with `Status:` lines and `~~~task` fenced blocks per phase. This is required for `/felix-loop` compatibility.

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

## Model Configuration

- **Codex sub-agents**: `codex exec -m gpt-5.3-codex -c model_reasoning_effort='"xhigh"'`
- **Claude sub-agents**: `claude --print --model opus --effort high`
- **Felix reviews**: Via felix-review CLI → Felix backend (localhost:6300)

## Felix Toolkit

- `/felix-loop start <plan-file>` — Autonomous implementation with review gates and Codex dispatch
- `/felix-review` — AI code review via Felix Code Reviewer backend
- Felix backend: `cd ~/felix-code-reviewer && npm run start:dev` (port 6300)
- Felix frontend: `cd ~/felix-code-reviewer/frontend && npm run dev` (port 6301)
<!-- FELIX_FRAMEWORK_END -->
