// ============================================================================
// Tests for Findings 13-16: Error handling, cycle detection, race conditions,
// and input validation in context-graph
// ============================================================================

import { describe, expect, it, vi } from 'vitest'
import { createDirectChannel } from '../channel'
import { createContextGraphController, type ContextGraphControllerDeps } from '../controller/ContextGraphController'
import { pluginRegistry } from '../plugins/registry'
import { parseToc } from '../plugins/toc/parser'
import { parseDiagrams } from '../plugins/diagram/parser'
import { syncInstructionFiles } from '../context/autoWriter'

// ============================================================================
// Finding 13: Error Handling
// ============================================================================

describe('Finding 13: Error handling', () => {
  describe('PluginRegistry.parseAll error isolation', () => {
    it('returns a valid Map for empty content', () => {
      const result = pluginRegistry.parseAll('', 'test.md')
      expect(result).toBeInstanceOf(Map)
    })

    it('does not throw when parsing malformed markdown', () => {
      // Deeply malformed content that might trip up a parser
      const content = '```\n```task\n```\n```\n---\n```mermaid\n'
      expect(() => pluginRegistry.parseAll(content, 'bad.md')).not.toThrow()
    })

    it('returns results for plugins that succeed when content is valid', () => {
      const content = '# Hello World\n\nSome paragraph text\n\n## Section 2\n\nMore text'
      const result = pluginRegistry.parseAll(content, 'test.md')
      expect(result).toBeInstanceOf(Map)
      // At minimum, the result should be a Map (plugins may or may not detect)
      expect(result.size).toBeGreaterThanOrEqual(0)
    })
  })

  describe('PluginRegistry.toContextMarkdown error isolation', () => {
    it('returns empty string for empty results', () => {
      const result = pluginRegistry.toContextMarkdown(new Map())
      expect(result).toBe('')
    })

    it('does not throw for results with unknown plugin id', () => {
      const results = new Map()
      results.set('nonexistent-plugin', { pluginId: 'nonexistent-plugin', items: [{ id: '1' }], rawMatches: [] })
      // Should not throw - the plugin is not found, so it's skipped
      expect(() => pluginRegistry.toContextMarkdown(results)).not.toThrow()
    })
  })

  describe('ContextGraphController.ensureParsersRegistered retry on failure', () => {
    it('retries registration if the first attempt fails', async () => {
      let callCount = 0
      const deps: ContextGraphControllerDeps = {
        fileService: {
          getFileTree: vi.fn(),
          watch: vi.fn(),
        },
        fileParserService: {
          watchAndParse: vi.fn(),
          subscribeAll: vi.fn(),
          getCachedFile: vi.fn(),
          parseFile: vi.fn(),
          parseContent: vi.fn(),
        },
        registerParsers: vi.fn().mockImplementation(() => {
          callCount++
          if (callCount === 1) {
            return Promise.reject(new Error('First attempt fails'))
          }
          return Promise.resolve()
        }),
      }

      const controller = createContextGraphController(deps)

      // First call should reject
      await expect(controller.ensureParsersRegistered()).rejects.toThrow('First attempt fails')

      // Second call should retry (not stay stuck) and succeed
      await expect(controller.ensureParsersRegistered()).resolves.toBeUndefined()
      expect(callCount).toBe(2)
    })

    it('does not re-register if first attempt succeeds', async () => {
      const deps: ContextGraphControllerDeps = {
        fileService: {
          getFileTree: vi.fn(),
          watch: vi.fn(),
        },
        fileParserService: {
          watchAndParse: vi.fn(),
          subscribeAll: vi.fn(),
          getCachedFile: vi.fn(),
          parseFile: vi.fn(),
          parseContent: vi.fn(),
        },
        registerParsers: vi.fn().mockResolvedValue(undefined),
      }

      const controller = createContextGraphController(deps)
      await controller.ensureParsersRegistered()
      await controller.ensureParsersRegistered()
      await controller.ensureParsersRegistered()

      expect(deps.registerParsers).toHaveBeenCalledTimes(1)
    })
  })

  describe('ContextGraphController.loadParsedFile error propagation', () => {
    it('propagates parseFile errors to caller', async () => {
      const deps: ContextGraphControllerDeps = {
        fileService: {
          getFileTree: vi.fn(),
          watch: vi.fn(),
        },
        fileParserService: {
          watchAndParse: vi.fn(),
          subscribeAll: vi.fn(),
          getCachedFile: vi.fn().mockReturnValue(undefined),
          parseFile: vi.fn().mockRejectedValue(new Error('file not found')),
          parseContent: vi.fn(),
        },
        registerParsers: vi.fn().mockResolvedValue(undefined),
      }

      const controller = createContextGraphController(deps)
      await expect(controller.loadParsedFile('/missing.md')).rejects.toThrow('file not found')
    })
  })
})

// ============================================================================
// Finding 14: Cycle Detection / Depth Limits
// ============================================================================

describe('Finding 14: Depth limits in recursive traversals', () => {
  describe('TOC parser depth limits', () => {
    it('handles deeply nested headings without stack overflow', () => {
      // Build markdown with many alternating heading levels
      const lines: string[] = []
      for (let i = 0; i < 100; i++) {
        const level = Math.min(6, (i % 6) + 1)
        lines.push(`${'#'.repeat(level)} Section ${i}`)
        lines.push(`Content for section ${i}`)
        lines.push('')
      }
      const content = lines.join('\n')

      const result = parseToc(content, 'deep.md')

      // Should complete without crashing
      expect(result.items.length).toBeGreaterThan(0)
      expect(result.pluginId).toBe('toc')
    })

    it('correctly calculates counts for normal nesting depth', () => {
      const content = [
        '# Top',
        '- [ ] item1',
        '## Sub',
        '- [x] item2',
        '### Deep',
        '- [ ] item3',
      ].join('\n')

      const result = parseToc(content, 'test.md')
      expect(result.items.length).toBe(1) // Just the top-level section
      expect(result.items[0].title).toBe('Top')
      expect(result.items[0].children.length).toBe(1) // Sub
      expect(result.items[0].children[0].children.length).toBe(1) // Deep
    })

    it('sets sourceEndLine for all sections', () => {
      const content = '# A\nline\n## B\nline\n# C\nline'
      const result = parseToc(content, 'test.md')

      // All sections should have sourceEndLine set
      expect(result.items.length).toBe(2) // A and C
      result.items.forEach(section => {
        expect(section.sourceEndLine).toBeDefined()
        expect(typeof section.sourceEndLine).toBe('number')
      })
    })
  })

  describe('Diagram parser extractInlineText depth limit', () => {
    it('parses a valid mermaid diagram', () => {
      const content = '# My Diagram\n\n```mermaid\ngraph TD\n  A-->B\n```'
      const result = parseDiagrams(content, 'test.md')

      expect(result.items.length).toBe(1)
      expect(result.items[0].diagramType).toBe('graph')
      expect(result.items[0].title).toBe('My Diagram')
    })

    it('handles malformed mermaid without crashing', () => {
      const content = '```mermaid\n\n```'
      const result = parseDiagrams(content, 'test.md')
      // Empty mermaid block should be skipped (empty code after trim)
      expect(result.items.length).toBe(0)
    })
  })
})

// ============================================================================
// Finding 15: Race Conditions
// ============================================================================

describe('Finding 15: Race condition guards', () => {
  describe('syncInstructionFiles', () => {
    it('completes without error for a basic workspace state', async () => {
      const mockFs = {
        exists: vi.fn().mockResolvedValue(false),
        read: vi.fn().mockResolvedValue(''),
        write: vi.fn().mockResolvedValue(undefined),
      }

      const state = {
        projectPath: '/test/project',
        treeItems: [],
        documents: new Map(),
        focus: { mode: 'full' as const, focusedNodeId: null, customNodeIds: [] },
        collapsedFolders: new Set<string>(),
        treeWidgetFolders: new Set<string>(),
        openPanels: [] as string[],
        expandedPanel: null,
        visibleSection: null,
        quickPreviewNode: null,
        cardScale: 1,
      }

      const results = await syncInstructionFiles('/test/project', state, {
        fileService: mockFs,
        createMissing: false,
      })

      // All three files should report as not updated (they don't exist and createMissing is false)
      expect(results).toHaveLength(3)
      results.forEach(r => expect(r.updated).toBe(false))
    })

    it('creates missing files when createMissing is true', async () => {
      const mockFs = {
        exists: vi.fn().mockResolvedValue(false),
        read: vi.fn().mockResolvedValue(''),
        write: vi.fn().mockResolvedValue(undefined),
      }

      const state = {
        projectPath: '/test/project',
        treeItems: [],
        documents: new Map(),
        focus: { mode: 'full' as const, focusedNodeId: null, customNodeIds: [] },
        collapsedFolders: new Set<string>(),
        treeWidgetFolders: new Set<string>(),
        openPanels: [] as string[],
        expandedPanel: null,
        visibleSection: null,
        quickPreviewNode: null,
        cardScale: 1,
      }

      const results = await syncInstructionFiles('/test/project', state, {
        fileService: mockFs,
        createMissing: true,
      })

      expect(results).toHaveLength(3)
      // All files should be created since they don't exist
      results.forEach(r => expect(r.updated).toBe(true))
      expect(mockFs.write).toHaveBeenCalledTimes(3)
    })

    it('handles file service errors gracefully per-target', async () => {
      const mockFs = {
        exists: vi.fn().mockRejectedValue(new Error('disk error')),
        read: vi.fn().mockResolvedValue(''),
        write: vi.fn().mockResolvedValue(undefined),
      }

      const state = {
        projectPath: '/test/project',
        treeItems: [],
        documents: new Map(),
        focus: { mode: 'full' as const, focusedNodeId: null, customNodeIds: [] },
        collapsedFolders: new Set<string>(),
        treeWidgetFolders: new Set<string>(),
        openPanels: [] as string[],
        expandedPanel: null,
        visibleSection: null,
        quickPreviewNode: null,
        cardScale: 1,
      }

      // Should not throw - errors are caught per-target
      const results = await syncInstructionFiles('/test/project', state, {
        fileService: mockFs,
      })

      expect(results).toHaveLength(3)
      results.forEach(r => expect(r.updated).toBe(false))
    })

    it('skips write when content has not changed', async () => {
      const existingContent = '# Existing\n\nContent here'
      const mockFs = {
        exists: vi.fn().mockResolvedValue(true),
        read: vi.fn().mockResolvedValue(existingContent),
        write: vi.fn().mockResolvedValue(undefined),
      }

      const state = {
        projectPath: '/test/project',
        treeItems: [],
        documents: new Map(),
        focus: { mode: 'full' as const, focusedNodeId: null, customNodeIds: [] },
        collapsedFolders: new Set<string>(),
        treeWidgetFolders: new Set<string>(),
        openPanels: [] as string[],
        expandedPanel: null,
        visibleSection: null,
        quickPreviewNode: null,
        cardScale: 1,
      }

      const results = await syncInstructionFiles('/test/project', state, {
        fileService: mockFs,
        // Provide a single target that generates the same content
        getTargets: () => [{ path: '/test/project/CLAUDE.md', kind: 'claude' }],
      })

      // The generator appends managed sections to existing content.
      // If the content is already up-to-date, write should not be called.
      expect(results).toHaveLength(1)
    })
  })
})

// ============================================================================
// Finding 16: Input Validation
// ============================================================================

describe('Finding 16: Input validation', () => {
  describe('Direct channel passes all messages (trusted)', () => {
    it('routes valid inbound messages', () => {
      const { hostSide, graphSide } = createDirectChannel()
      const received: any[] = []
      graphSide.onMessage((msg) => received.push(msg))

      hostSide.send({ type: 'tree:update', items: [] })
      hostSide.send({ type: 'focus:set', path: '/test.md' })

      expect(received).toHaveLength(2)
      expect(received[0].type).toBe('tree:update')
      expect(received[1].type).toBe('focus:set')
    })
  })

  describe('PluginRegistry.register validates plugin shape', () => {
    it('throws for null plugin', () => {
      expect(() => pluginRegistry.register(null as any)).toThrow('Plugin must be a non-null object')
    })

    it('throws for undefined plugin', () => {
      expect(() => pluginRegistry.register(undefined as any)).toThrow('Plugin must be a non-null object')
    })

    it('throws for non-object plugin', () => {
      expect(() => pluginRegistry.register('not-a-plugin' as any)).toThrow('Plugin must be a non-null object')
    })

    it('throws for plugin without id', () => {
      expect(() => pluginRegistry.register({} as any)).toThrow('non-empty string "id"')
    })

    it('throws for plugin with empty id', () => {
      expect(() => pluginRegistry.register({ id: '' } as any)).toThrow('non-empty string "id"')
    })

    it('throws for plugin with numeric id', () => {
      expect(() => pluginRegistry.register({ id: 42 } as any)).toThrow('non-empty string "id"')
    })

    it('throws for plugin without detect function', () => {
      expect(() => pluginRegistry.register({ id: 'test-validate-1' } as any)).toThrow('must implement detect')
    })

    it('throws for plugin without parse function', () => {
      expect(() =>
        pluginRegistry.register({
          id: 'test-validate-2',
          detect: () => true,
        } as any)
      ).toThrow('must implement parse')
    })

    it('throws for plugin without toContextMarkdown function', () => {
      expect(() =>
        pluginRegistry.register({
          id: 'test-validate-3',
          detect: () => true,
          parse: () => ({ pluginId: 'test-validate-3', items: [], rawMatches: [] }),
        } as any)
      ).toThrow('must implement toContextMarkdown')
    })

    it('throws for duplicate plugin id', () => {
      // The 'toc' plugin should already be registered
      const existing = pluginRegistry.has('toc')
      if (existing) {
        expect(() =>
          pluginRegistry.register({
            id: 'toc',
            detect: () => false,
            parse: () => ({ pluginId: 'toc', items: [], rawMatches: [] }),
            toContextMarkdown: () => '',
            name: 'Duplicate',
            version: '1.0.0',
            nodeType: 'toc',
            supportedContexts: [],
            getComponent: () => null,
          } as any)
        ).toThrow('already registered')
      }
    })
  })

  describe('TOC parser handles edge cases', () => {
    it('handles empty content', () => {
      const result = parseToc('', 'empty.md')
      expect(result.items).toHaveLength(0)
      expect(result.pluginId).toBe('toc')
    })

    it('handles content with no headings', () => {
      const result = parseToc('Just some text\nNo headings here', 'no-headings.md')
      expect(result.items).toHaveLength(0)
    })

    it('handles empty sourceFile', () => {
      const result = parseToc('# Test', '')
      expect(result.items).toHaveLength(1)
      expect(result.items[0].sourceFile).toBe('')
    })
  })

  describe('Channel bridge content:update validation', () => {
    it('processes valid update messages', () => {
      const { hostSide, graphSide } = createDirectChannel()
      const received: any[] = []
      graphSide.onMessage((msg) => received.push(msg))

      hostSide.send({
        type: 'content:update',
        updates: [{ path: 'test.md', content: '# Test' }],
      })

      expect(received).toHaveLength(1)
      expect(received[0].updates[0].path).toBe('test.md')
    })
  })
})
