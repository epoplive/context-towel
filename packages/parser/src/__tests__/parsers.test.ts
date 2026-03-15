import { describe, it, expect } from 'vitest'

// Task
import { detectTasks, parseTasks } from '../plugins/task'
// Checklist
import { detectChecklists, parseChecklists } from '../plugins/checklist'
// TOC
import { detectToc, parseToc } from '../plugins/toc'
// Diagram
import { detectDiagrams, parseDiagrams } from '../plugins/diagram'
// Log
import { detectLogs, parseLogs } from '../plugins/log'
// Link
import { detectLinks, parseLinks } from '../plugins/link'

// -------------------------------------------------------------------------- //
// Task parser
// -------------------------------------------------------------------------- //

const TASK_BLOCK = `
\`\`\`task
id: my-task
title: Build the feature
status: in-progress
priority: high
tags: #frontend #core
blocked-by: [[other-task]]
description: |
  This is the task description.
checklist:
  - [x] Step one done
  - [ ] Step two todo
log:
  - [2026-01-01] Started work
notes: |
  Extra notes here.
\`\`\`
`.trim()

const TASK_TILDE_BLOCK = `
~~~task
title: Tilde Task
status: done
priority: low
~~~
`.trim()

describe('task parser', () => {
  it('detects backtick task blocks', () => {
    expect(detectTasks(TASK_BLOCK)).toBe(true)
  })

  it('detects tilde task blocks', () => {
    expect(detectTasks(TASK_TILDE_BLOCK)).toBe(true)
  })

  it('returns false for content without task blocks', () => {
    expect(detectTasks('# Just a heading\n\nSome text.')).toBe(false)
  })

  it('parses title, status, priority', () => {
    const result = parseTasks(TASK_BLOCK, '/project/tasks.md')
    expect(result.pluginId).toBe('task')
    expect(result.items).toHaveLength(1)
    const task = result.items[0]
    expect(task.title).toBe('Build the feature')
    expect(task.status).toBe('in-progress')
    expect(task.priority).toBe('high')
  })

  it('parses explicit id', () => {
    const result = parseTasks(TASK_BLOCK, '/project/tasks.md')
    expect(result.items[0].id).toBe('my-task')
    expect(result.items[0].explicitId).toBe('my-task')
  })

  it('generates implicit id from title + file when no explicit id', () => {
    const block = '```task\ntitle: My Task\nstatus: todo\n```'
    const result = parseTasks(block, '/project/.context/working/stuff.md')
    const task = result.items[0]
    expect(task.id).toContain('my-task')
    expect(task.explicitId).toBeUndefined()
  })

  it('parses tags', () => {
    const result = parseTasks(TASK_BLOCK, '/project/tasks.md')
    expect(result.items[0].tags).toContain('frontend')
    expect(result.items[0].tags).toContain('core')
  })

  it('parses blocked-by as wiki links', () => {
    const result = parseTasks(TASK_BLOCK, '/project/tasks.md')
    expect(result.items[0].blockedBy).toContain('other-task')
  })

  it('parses checklist items', () => {
    const result = parseTasks(TASK_BLOCK, '/project/tasks.md')
    const checklist = result.items[0].checklist
    expect(checklist).toHaveLength(2)
    expect(checklist[0].checked).toBe(true)
    expect(checklist[0].text).toBe('Step one done')
    expect(checklist[1].checked).toBe(false)
  })

  it('calculates progress from checklist', () => {
    const result = parseTasks(TASK_BLOCK, '/project/tasks.md')
    expect(result.items[0].progress).toBe(50) // 1 of 2 done
  })

  it('parses log entries', () => {
    const result = parseTasks(TASK_BLOCK, '/project/tasks.md')
    const log = result.items[0].log
    expect(log).toHaveLength(1)
    expect(log[0].timestamp).toBe('2026-01-01')
    expect(log[0].entry).toBe('Started work')
  })

  it('parses description and notes', () => {
    const result = parseTasks(TASK_BLOCK, '/project/tasks.md')
    const task = result.items[0]
    expect(task.description).toContain('task description')
    expect(task.notes).toContain('Extra notes')
  })

  it('parses tilde fenced blocks', () => {
    const result = parseTasks(TASK_TILDE_BLOCK, '/project/tasks.md')
    expect(result.items).toHaveLength(1)
    expect(result.items[0].title).toBe('Tilde Task')
    expect(result.items[0].status).toBe('done')
  })

  it('parses multiple tasks from one file', () => {
    const content = [TASK_BLOCK, '', TASK_TILDE_BLOCK].join('\n\n')
    const result = parseTasks(content, '/project/tasks.md')
    expect(result.items).toHaveLength(2)
  })

  it('populates rawMatches', () => {
    const result = parseTasks(TASK_BLOCK, '/project/tasks.md')
    expect(result.rawMatches).toBeDefined()
    expect(result.rawMatches!.length).toBeGreaterThan(0)
    const match = result.rawMatches![0]
    expect(match.startLine).toBeGreaterThanOrEqual(1)
  })

  it('returns empty items for malformed block', () => {
    const result = parseTasks('not a task block at all', '/project/tasks.md')
    expect(result.items).toHaveLength(0)
  })

  it('defaults status to todo when not specified', () => {
    const result = parseTasks('```task\ntitle: Simple\n```', '/f.md')
    expect(result.items[0].status).toBe('todo')
  })

  it('defaults priority to medium when not specified', () => {
    const result = parseTasks('```task\ntitle: Simple\n```', '/f.md')
    expect(result.items[0].priority).toBe('medium')
  })
})

// -------------------------------------------------------------------------- //
// Checklist parser
// -------------------------------------------------------------------------- //

const CHECKLIST_MD = `
# My Section

- [x] Done item
- [ ] Todo item
- [ ] Another todo

## Subsection

- [x] Sub done
`.trim()

describe('checklist parser', () => {
  it('detects checklist items', () => {
    expect(detectChecklists(CHECKLIST_MD)).toBe(true)
  })

  it('returns false for content without checklists', () => {
    expect(detectChecklists('# Heading\n\nJust text.')).toBe(false)
  })

  it('parses checklist groups by heading', () => {
    const result = parseChecklists(CHECKLIST_MD, '/f.md')
    expect(result.pluginId).toBe('checklist')
    expect(result.items.length).toBeGreaterThanOrEqual(1)
  })

  it('calculates progress', () => {
    const result = parseChecklists(CHECKLIST_MD, '/f.md')
    const group = result.items[0]
    // 1 done out of 3 total
    expect(group.progress).toBe(Math.round((1 / 3) * 100))
  })

  it('sets sourceFile', () => {
    const result = parseChecklists(CHECKLIST_MD, '/my/file.md')
    expect(result.items[0].sourceFile).toBe('/my/file.md')
  })

  it('uses nearest heading as title', () => {
    const result = parseChecklists(CHECKLIST_MD, '/f.md')
    expect(result.items[0].title).toBe('My Section')
  })

  it('does not include fully-empty sections', () => {
    const content = '# Empty\n\nNo checklist here.\n\n# Has One\n\n- [x] Done'
    const result = parseChecklists(content, '/f.md')
    const titles = result.items.map((i) => i.title)
    expect(titles).not.toContain('Empty')
    expect(titles).toContain('Has One')
  })
})

// -------------------------------------------------------------------------- //
// TOC parser
// -------------------------------------------------------------------------- //

const TOC_MD = `
# Chapter 1

Content one.

- [ ] Unchecked item

## Section 1.1

Sub content.

- [x] Checked item

# Chapter 2

Content two.
`.trim()

describe('toc parser', () => {
  it('detects headings', () => {
    expect(detectToc(TOC_MD)).toBe(true)
  })

  it('returns false for content without headings', () => {
    expect(detectToc('Just text.\n\n- bullet')).toBe(false)
  })

  it('parses top-level sections', () => {
    const result = parseToc(TOC_MD, '/f.md')
    expect(result.pluginId).toBe('toc')
    expect(result.items).toHaveLength(2)
    expect(result.items[0].title).toBe('Chapter 1')
    expect(result.items[1].title).toBe('Chapter 2')
  })

  it('parses nested sections', () => {
    const result = parseToc(TOC_MD, '/f.md')
    expect(result.items[0].children).toHaveLength(1)
    expect(result.items[0].children[0].title).toBe('Section 1.1')
  })

  it('sets heading levels', () => {
    const result = parseToc(TOC_MD, '/f.md')
    expect(result.items[0].level).toBe(1)
    expect(result.items[0].children[0].level).toBe(2)
  })

  it('counts checklist items (not tasks)', () => {
    const result = parseToc(TOC_MD, '/f.md')
    // Chapter 1 has 1 unchecked + 1 checked (in sub-section) = 2 total checklists
    const ch1 = result.items[0]
    expect(ch1.counts.checklists).toBeGreaterThanOrEqual(1)
  })

  it('sets sourceFile on sections', () => {
    const result = parseToc(TOC_MD, '/my/doc.md')
    expect(result.items[0].sourceFile).toBe('/my/doc.md')
  })

  it('sets sourceLine', () => {
    const result = parseToc(TOC_MD, '/f.md')
    expect(result.items[0].sourceLine).toBe(1)
  })

  it('sets sourceEndLine', () => {
    const result = parseToc(TOC_MD, '/f.md')
    const ch1 = result.items[0]
    expect(ch1.sourceEndLine).toBeDefined()
    expect(ch1.sourceEndLine!).toBeGreaterThan(ch1.sourceLine!)
  })

  it('generates slug id', () => {
    const result = parseToc(TOC_MD, '/f.md')
    expect(result.items[0].id).toBe('chapter-1')
  })
})

// -------------------------------------------------------------------------- //
// Diagram parser
// -------------------------------------------------------------------------- //

const DIAGRAM_MD = `
## Architecture

\`\`\`mermaid
flowchart TD
  A --> B
  B --> C
\`\`\`

## Sequence

\`\`\`mermaid
sequenceDiagram
  Alice ->> Bob: Hello
\`\`\`
`.trim()

describe('diagram parser', () => {
  it('detects mermaid blocks', () => {
    expect(detectDiagrams(DIAGRAM_MD)).toBe(true)
  })

  it('returns false for content without mermaid blocks', () => {
    expect(detectDiagrams('```js\nconsole.log()\n```')).toBe(false)
  })

  it('parses two diagrams', () => {
    const result = parseDiagrams(DIAGRAM_MD, '/f.md')
    expect(result.pluginId).toBe('diagram')
    expect(result.items).toHaveLength(2)
  })

  it('extracts diagram code', () => {
    const result = parseDiagrams(DIAGRAM_MD, '/f.md')
    expect(result.items[0].code).toContain('flowchart TD')
    expect(result.items[1].code).toContain('sequenceDiagram')
  })

  it('detects diagram type from first line', () => {
    const result = parseDiagrams(DIAGRAM_MD, '/f.md')
    expect(result.items[0].diagramType).toBe('flowchart')
    expect(result.items[1].diagramType).toBe('sequenceDiagram')
  })

  it('uses nearest heading as title', () => {
    const result = parseDiagrams(DIAGRAM_MD, '/f.md')
    expect(result.items[0].title).toBe('Architecture')
    expect(result.items[1].title).toBe('Sequence')
  })

  it('sets sourceFile', () => {
    const result = parseDiagrams(DIAGRAM_MD, '/arch.md')
    expect(result.items[0].sourceFile).toBe('/arch.md')
  })

  it('populates rawMatches', () => {
    const result = parseDiagrams(DIAGRAM_MD, '/f.md')
    expect(result.rawMatches!.length).toBe(2)
  })

  it('returns empty for content without mermaid code', () => {
    const result = parseDiagrams('# Title\n\nJust text.', '/f.md')
    expect(result.items).toHaveLength(0)
  })
})

// -------------------------------------------------------------------------- //
// Log parser
// -------------------------------------------------------------------------- //

const LOG_MD = `
# Work Log

### Log

- [2026-01-01] Started implementation | created files | write tests
- [2026-01-02] Fixed bug | resolved null crash
- [2026-01-03] Deployed
`.trim()

describe('log parser', () => {
  it('detects ### Log sections', () => {
    expect(detectLogs(LOG_MD)).toBe(true)
  })

  it('detects timestamped entries without heading', () => {
    expect(detectLogs('- [2026-01-01] Did something')).toBe(true)
  })

  it('returns false for content without log sections', () => {
    expect(detectLogs('# Title\n\n- [ ] checklist item')).toBe(false)
  })

  it('parses log section', () => {
    const result = parseLogs(LOG_MD, '/f.md')
    expect(result.pluginId).toBe('log')
    expect(result.items).toHaveLength(1)
  })

  it('parses log entries', () => {
    const result = parseLogs(LOG_MD, '/f.md')
    const entries = result.items[0].entries
    expect(entries).toHaveLength(3)
    expect(entries[0].timestamp).toBe('2026-01-01')
    expect(entries[0].action).toBe('Started implementation')
  })

  it('parses structured entry fields (action | result | next)', () => {
    const result = parseLogs(LOG_MD, '/f.md')
    const first = result.items[0].entries[0]
    expect(first.result).toBe('created files')
    expect(first.next).toBe('write tests')
  })

  it('sets sourceFile', () => {
    const result = parseLogs(LOG_MD, '/my/log.md')
    expect(result.items[0].sourceFile).toBe('/my/log.md')
  })
})

// -------------------------------------------------------------------------- //
// Link parser
// -------------------------------------------------------------------------- //

const LINK_MD = `
See [[other-doc]] for more.
Also check [[tasks|Task List]] here.

Read [the guide](guide.md) for details.
External [link](https://example.com) not extracted.

\`\`\`task
blocked-by: [[inside-code]]
\`\`\`
`.trim()

describe('link parser', () => {
  it('detects wiki links', () => {
    expect(detectLinks('See [[some-doc]].')).toBe(true)
  })

  it('detects markdown links to .md files', () => {
    expect(detectLinks('[read more](notes.md)')).toBe(true)
  })

  it('returns false for content without links', () => {
    expect(detectLinks('# Title\n\nJust prose.')).toBe(false)
  })

  it('does not extract external URLs from parseLinks (only .md links)', () => {
    // detectLinks fires the raw regex which matches any [text](url) shape.
    // The filtering to markdown-only documents happens inside parseLinks.
    const result = parseLinks('[visit](https://example.com)', '/f.md')
    expect(result.items).toHaveLength(0)
  })

  it('parses wiki links', () => {
    const result = parseLinks(LINK_MD, '/f.md')
    const wikiLinks = result.items.filter((l) => l.kind === 'wiki')
    const targets = wikiLinks.map((l) => l.target)
    expect(targets).toContain('other-doc')
    expect(targets).toContain('tasks')
  })

  it('parses display text from wiki links', () => {
    const result = parseLinks(LINK_MD, '/f.md')
    const tasksLink = result.items.find((l) => l.target === 'tasks')
    expect(tasksLink?.text).toBe('Task List')
  })

  it('parses markdown links to .md files', () => {
    const result = parseLinks(LINK_MD, '/f.md')
    const mdLinks = result.items.filter((l) => l.kind === 'markdown')
    expect(mdLinks.some((l) => l.target === 'guide.md')).toBe(true)
  })

  it('does not parse links inside code blocks', () => {
    const result = parseLinks(LINK_MD, '/f.md')
    const targets = result.items.map((l) => l.target)
    expect(targets).not.toContain('inside-code')
  })

  it('sets sourceFile', () => {
    const result = parseLinks('[[doc]]', '/my/file.md')
    expect(result.items[0].sourceFile).toBe('/my/file.md')
  })

  it('sets sourceLine', () => {
    const content = 'line one\n[[doc]]\nline three'
    const result = parseLinks(content, '/f.md')
    expect(result.items[0].sourceLine).toBe(2)
  })

  it('populates rawMatches', () => {
    const result = parseLinks('[[doc]]', '/f.md')
    expect(result.rawMatches!.length).toBeGreaterThan(0)
  })
})
