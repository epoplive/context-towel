import { describe, expect, it, vi } from 'vitest'
import type { StoreState } from '../state'
import { buildWorkspaceStateFromGraph, syncInstructionFiles } from './autoWriter'
import { blockRegistry } from '@context-towel/card-library'
import { blockPlugin } from '../plugins/block'
import { pluginRegistry } from '../plugins/registry'

const createStoreState = (): StoreState => ({
  projectPath: '/project',
  treeItems: [
    { id: 'CLAUDE.md', name: 'CLAUDE.md', path: '/project/CLAUDE.md', is_dir: false },
    { id: 'docs/plan.md', name: 'plan.md', path: '/project/docs/plan.md', is_dir: false },
  ],
  docContents: new Map([
    ['docs/plan.md', {
      content: '# Plan',
      tasks: [],
      sections: [],
      checklists: [],
      diagrams: [],
    }],
  ]),
  focusedNode: 'docs/plan.md',
  customFocusNodes: ['docs/plan.md', 'docs/other.md'],
  expandedPanel: 'docs/plan.md',
  expandedPanels: new Set(['docs/plan.md']),
  collapsedFolders: new Set<string>(),
  treeWidgetFolders: new Set<string>(),
  quickPreviewNode: null,
  cardScale: 1,
} as unknown as StoreState)

const createWorkspaceState = (): import('../types').WorkspaceState => ({
  projectPath: '/project',
  treeItems: [],
  documents: new Map(),
  focus: { mode: 'full' as const, focusedNodeId: null, customNodeIds: [] },
  collapsedFolders: new Set<string>(),
  treeWidgetFolders: new Set<string>(),
  openPanels: [],
  expandedPanel: null,
  visibleSection: null,
  quickPreviewNode: null,
  cardScale: 1,
})

describe('context instruction auto-writer', () => {
  it('builds workspace state from graph store snapshot', () => {
    const snapshot = createStoreState()
    const workspace = buildWorkspaceStateFromGraph(snapshot)

    expect(workspace.projectPath).toBe('/project')
    expect(workspace.focus.mode).toBe('custom')
    expect(workspace.openPanels).toEqual(['docs/plan.md'])
    const doc = workspace.documents.get('docs/plan.md')
    expect(doc?.path).toBe('/project/docs/plan.md')
  })

  it('writes updated instruction files when content changes', async () => {
    const fs = {
      exists: vi.fn().mockResolvedValue(true),
      read: vi.fn().mockResolvedValue('# Base\n'),
      write: vi.fn().mockResolvedValue(undefined),
    }

    const results = await syncInstructionFiles('/project', createWorkspaceState(), {
      fileService: fs,
      getTargets: (projectPath) => [
        { path: `${projectPath}/CLAUDE.md`, kind: 'claude' },
        { path: `${projectPath}/GEMINI.md`, kind: 'gemini' },
      ],
    })

    expect(fs.write).toHaveBeenCalledTimes(2)
    expect(fs.write).toHaveBeenCalledWith(
      '/project/CLAUDE.md',
      expect.stringContaining('LOOKING_GLASS_CURRENT_FOCUS_START')
    )
    expect(fs.write).toHaveBeenCalledWith(
      '/project/GEMINI.md',
      expect.stringContaining('LOOKING_GLASS_CURRENT_FOCUS_START')
    )
    expect(results[0]?.updated).toBe(true)
  })

  it('skips missing files when createMissing is false', async () => {
    const fs = {
      exists: vi.fn().mockResolvedValue(false),
      read: vi.fn(),
      write: vi.fn(),
    }

    const results = await syncInstructionFiles('/project', createWorkspaceState(), {
      fileService: fs,
      getTargets: () => [{ path: '/project/AGENTS.md', kind: 'agents' }],
    })

    expect(fs.write).not.toHaveBeenCalled()
    expect(results[0]?.updated).toBe(false)
  })

  it('includes custom block context in generated instructions', async () => {
    if (pluginRegistry.has('block')) {
      pluginRegistry.unregister('block')
    }
    pluginRegistry.register(blockPlugin)
    if (!blockRegistry.has('note')) {
      blockRegistry.register({
        type: 'note',
        name: 'Note',
        toContextMarkdown: (blocks: any[]) => {
          const lines = ['### Notes']
          blocks.forEach((block: any) => {
            const text = (block.data as { text?: string } | null)?.text ?? 'Untitled'
            lines.push(`- ${text}`)
          })
          return lines.join('\n')
        },
      })
    }

    const snapshot = {
      projectPath: '/project',
      treeItems: [
        { id: 'CLAUDE.md', name: 'CLAUDE.md', path: '/project/CLAUDE.md', is_dir: false },
        { id: 'docs/notes.md', name: 'notes.md', path: '/project/docs/notes.md', is_dir: false },
      ],
      docContents: new Map([
        ['docs/notes.md', {
          content: ['# Notes', '', '```note', 'text: Hello world', '```'].join('\n'),
          tasks: [],
          sections: [],
          checklists: [],
          diagrams: [],
        }],
      ]),
      focusedNode: 'docs/notes.md',
      customFocusNodes: null,
      expandedPanel: 'docs/notes.md',
      expandedPanels: new Set(['docs/notes.md']),
      collapsedFolders: new Set<string>(),
      treeWidgetFolders: new Set<string>(),
      quickPreviewNode: null,
      cardScale: 1,
    } as unknown as StoreState

    const workspace = buildWorkspaceStateFromGraph(snapshot)
    const doc = workspace.documents.get('docs/notes.md')
    if (doc) {
      doc.extractions = new Map([['block', {
        pluginId: 'block',
        items: [{
          id: 'note:docs/notes.md:1',
          sourceFile: 'docs/notes.md',
          sourceLine: 1,
          sourceEndLine: 3,
          blockType: 'note',
          data: { text: 'Hello world' },
          raw: '```note\ntext: Hello world\n```',
          range: { startOffset: null, endOffset: null, startLine: null, endLine: null },
        }],
        rawMatches: [],
      }]])
    }
    const fs = {
      exists: vi.fn().mockResolvedValue(true),
      read: vi.fn().mockResolvedValue('# Base\n'),
      write: vi.fn().mockResolvedValue(undefined),
    }

    await syncInstructionFiles('/project', workspace, {
      fileService: fs,
      getTargets: (projectPath) => [{ path: `${projectPath}/CLAUDE.md`, kind: 'claude' }],
    })

    expect(fs.write).toHaveBeenCalledWith(
      '/project/CLAUDE.md',
      expect.stringContaining('### Notes')
    )
    expect(fs.write).toHaveBeenCalledWith(
      '/project/CLAUDE.md',
      expect.stringContaining('- Hello world')
    )
  })
})
