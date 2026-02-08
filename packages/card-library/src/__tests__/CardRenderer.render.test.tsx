import React from 'react'
import { describe, expect, it, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

import {
  CardRenderer,
  CardThemeProvider,
  defaultTheme,
  parseMarkdownBlocks,
  registerAllCardPlugins,
  registerCoreBlocks,
} from '../index'
import { blockRegistry } from '../blocks/registry'

type Detail = 'mini' | 'summary' | 'full'

function renderBlockHtml(block: any, detail: Detail): string {
  return renderToStaticMarkup(
    <CardThemeProvider theme={defaultTheme}>
      <CardRenderer block={block} detail={detail} context="card" />
    </CardThemeProvider>
  )
}

describe('CardRenderer (render smoke)', () => {
  beforeEach(() => {
    blockRegistry.clear()
    registerCoreBlocks()
    registerAllCardPlugins()
  })

  it('renders all built-in block types across detail levels', () => {
    const markdown = [
      '```task',
      'id: t1',
      'title: Build feature',
      'status: in-progress',
      'priority: high',
      'checklist:',
      '  - [x] Step 1',
      '  - [ ] Step 2',
      '```',
      '',
      '```checklist',
      'title: Setup',
      'progress: 50',
      'items:',
      '  - text: Install deps',
      '    checked: true',
      '  - text: Run tests',
      '    checked: false',
      '```',
      '',
      '```diagram',
      'title: Demo Diagram',
      'diagramType: flowchart',
      'code: |',
      '  graph TD;',
      '    A-->B;',
      '```',
      '',
      '```toc',
      'docName: Demo Doc',
      'sections:',
      '  - title: Intro',
      '    level: 1',
      '    children: []',
      '```',
      '',
      '```note',
      'title: Design Note',
      'content: Decisions recorded here.',
      'noteType: decision',
      '```',
      '',
      '```rule',
      'name: No Blocking IO On UI Thread',
      'description: Never block the UI/IPC threads; always offload to async tasks.',
      'ruleType: performance',
      'priority: 9',
      '```',
      '',
      '```question',
      'text: Pick one',
      'options:',
      '  - id: a',
      '    label: Option A',
      '  - id: b',
      '    label: Option B',
      '```',
      '',
      '```form',
      'id: contact',
      'title: Contact Form',
      'mode: single',
      'steps:',
      '  - id: step1',
      '    fields:',
      '      - id: name',
      '        label: Name',
      '        type: text',
      '        required: true',
      '```',
      '',
      '```command-result',
      'command: echo hello',
      'exitCode: 0',
      'output: hello',
      'duration: 12',
      '```',
      '',
      '```file-content',
      'path: src/app.ts',
      'language: ts',
      'action: read',
      'lines: 2',
      'content: |',
      '  export const x = 1',
      '  console.log(x)',
      '```',
      '',
      '```file-diff',
      'path: src/app.ts',
      'language: ts',
      'additions: 1',
      'deletions: 0',
      'hunks:',
      '  - before: |-',
      '      - old',
      '    after: |-',
      '      + new',
      '```',
      '',
      '```file-list',
      'pattern: \"*.ts\"',
      'count: 2',
      'matches:',
      '  - path: src/a.ts',
      '    type: file',
      '  - path: src/b.ts',
      '    type: file',
      'truncated: false',
      '```',
      '',
    ].join('\n')

    const { blocks } = parseMarkdownBlocks(markdown, 'test.md')

    // Ensure expected types are registered (helps catch accidental registry regressions).
    const expectedTypes = [
      'task',
      'checklist',
      'diagram',
      'toc',
      'note',
      'rule',
      'question',
      'form',
      'command-result',
      'file-content',
      'file-diff',
      'file-list',
    ]
    expectedTypes.forEach((t) => expect(blockRegistry.has(t)).toBe(true))

    const byType = new Map(blocks.map((b) => [b.type, b]))
    expectedTypes.forEach((t) => expect(byType.has(t)).toBe(true))

    const detailLevels: Detail[] = ['mini', 'summary', 'full']

    for (const type of expectedTypes) {
      const block = byType.get(type)!
      for (const detail of detailLevels) {
        const html = renderBlockHtml(block, detail)
        expect(html).toContain('<') // sanity: non-empty markup
      }
    }

    // Spot-check a few key user-visible strings so this test also acts as a light characterization.
    expect(renderBlockHtml(byType.get('task')!, 'full')).toContain('Build feature')
    expect(renderBlockHtml(byType.get('form')!, 'summary')).toContain('Contact Form')
    expect(renderBlockHtml(byType.get('rule')!, 'mini')).toContain('No Blocking IO On UI Thread')
    expect(renderBlockHtml(byType.get('file-list')!, 'full')).toContain('src/a.ts')
  })
})

