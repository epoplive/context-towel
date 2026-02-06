import { useState } from 'react'
import { createDirectChannel, type TreeItem, type ContentUpdate } from '../channel'

// Mock data for development
const mockTreeItems: TreeItem[] = [
  { id: '.context/working', name: 'working', path: '.context/working', is_dir: true },
  { id: '.context/working/plan.md', name: 'plan.md', path: '.context/working/plan.md', is_dir: false },
  { id: '.context/working/tasks.md', name: 'tasks.md', path: '.context/working/tasks.md', is_dir: false },
  { id: '.context/docs', name: 'docs', path: '.context/docs', is_dir: true },
  { id: '.context/docs/architecture.md', name: 'architecture.md', path: '.context/docs/architecture.md', is_dir: false },
]

const mockContent: ContentUpdate[] = [
  {
    path: '.context/working/plan.md',
    content: `# Project Plan

## Overview
This is a sample plan document for development.

---

\`\`\`task
id: sample-task-1
title: Build the card library
status: in-progress
priority: high
tags: #cards #core
description: |
  Build the shared card rendering library.
checklist:
  - [x] Set up package structure
  - [ ] Define block plugin interface
  - [ ] Implement task block
  - [ ] Implement checklist block
\`\`\`

\`\`\`task
id: sample-task-2
title: Port context graph
status: todo
priority: high
tags: #graph #migration
blocked-by: [[sample-task-1]]
description: |
  Copy context graph code and refactor to use card library.
checklist:
  - [ ] Copy FlowNodes
  - [ ] Cut LG dependencies
  - [ ] Refactor to shared cards
\`\`\`
`,
  },
  {
    path: '.context/working/tasks.md',
    content: `# Active Tasks

- [ ] Set up monorepo
- [x] Define channel API
- [ ] Port block plugins
`,
  },
]

export function DevApp() {
  const [log, setLog] = useState<string[]>([])

  const { hostSide, graphSide } = createDirectChannel()

  // Listen for outbound messages from the graph
  hostSide.onMessage((msg) => {
    setLog(prev => [...prev, `← ${msg.type}: ${JSON.stringify(msg).slice(0, 100)}`])
  })

  const sendTree = () => {
    hostSide.send({ type: 'tree:update', items: mockTreeItems })
    setLog(prev => [...prev, `→ tree:update (${mockTreeItems.length} items)`])
  }

  const sendContent = () => {
    hostSide.send({ type: 'content:update', updates: mockContent })
    setLog(prev => [...prev, `→ content:update (${mockContent.length} files)`])
  }

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <h1 style={{ fontSize: 24, marginBottom: 8 }}>
        Context Towel - Dev Server
      </h1>
      <p style={{ color: '#a0a0b0', marginBottom: 24, fontSize: 14 }}>
        Don't panic. Graph app will render here once components are ported.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <button
          onClick={sendTree}
          style={{
            padding: '8px 16px',
            background: '#4a9eff',
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          Send Tree Data
        </button>
        <button
          onClick={sendContent}
          style={{
            padding: '8px 16px',
            background: '#4ade80',
            color: '#1a1a2e',
            border: 'none',
            borderRadius: 6,
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          Send Content
        </button>
      </div>

      <div style={{
        background: '#0d0d1a',
        borderRadius: 8,
        padding: 16,
        fontFamily: 'monospace',
        fontSize: 12,
        maxHeight: 400,
        overflow: 'auto',
      }}>
        <div style={{ color: '#606070', marginBottom: 8 }}>Channel Log:</div>
        {log.length === 0 && (
          <div style={{ color: '#404050' }}>No messages yet. Click a button above.</div>
        )}
        {log.map((entry, i) => (
          <div key={i} style={{ color: entry.startsWith('→') ? '#4ade80' : '#4a9eff', marginBottom: 2 }}>
            {entry}
          </div>
        ))}
      </div>
    </div>
  )
}
