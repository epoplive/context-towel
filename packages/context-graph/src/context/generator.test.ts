import { describe, expect, it, vi } from 'vitest'
import type { WorkspaceState } from '../types'
import {
  FOCUS_START_MARKER,
  FOCUS_END_MARKER,
  generateAgentsMd,
  generateClaudeMd,
} from './generator'
import { FRAMEWORK_START_MARKER, FRAMEWORK_END_MARKER } from './frameworkRules'

vi.mock('../plugins/registry', () => ({
  pluginRegistry: {
    toContextMarkdown: () => '### Mock Plugin\n- Item',
  },
}))

const createState = (): WorkspaceState => ({
  projectPath: '/projects/project-a',
  treeItems: [],
  documents: new Map(),
  focus: {
    mode: 'single',
    focusedNodeId: 'docs/plan.md',
    customNodeIds: [],
  },
  collapsedFolders: new Set(),
  treeWidgetFolders: new Set(),
  openPanels: [],
  expandedPanel: null,
  visibleSection: null,
  quickPreviewNode: null,
  cardScale: 1,
})

describe('context generator', () => {
  it('adds managed sections when markers are missing', () => {
    const base = '# Project Notes'
    const state = createState()
    const output = generateClaudeMd(state, base)

    expect(output).toContain(FRAMEWORK_START_MARKER)
    expect(output).toContain(FRAMEWORK_END_MARKER)
    expect(output).toContain(FOCUS_START_MARKER)
    expect(output).toContain(FOCUS_END_MARKER)
  })

  it('replaces existing managed sections', () => {
    const base = [
      '# Title',
      FRAMEWORK_START_MARKER,
      'old framework',
      FRAMEWORK_END_MARKER,
      FOCUS_START_MARKER,
      'old focus',
      FOCUS_END_MARKER,
    ].join('\n')
    const state = createState()
    const output = generateClaudeMd(state, base)

    expect(output).not.toContain('old framework')
    expect(output).not.toContain('old focus')
    expect(output).toContain('## Current Focus')
  })

  it('omits framework section for agents.md', () => {
    const state = createState()
    const output = generateAgentsMd(state, '# Base')

    expect(output).toContain(FOCUS_START_MARKER)
    expect(output).not.toContain(FRAMEWORK_START_MARKER)
  })
})
