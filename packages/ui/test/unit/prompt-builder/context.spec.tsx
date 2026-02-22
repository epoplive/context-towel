import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import {
  PromptBuilderProvider,
  usePromptBuilderStore,
  usePromptPort,
  useRulesProvider,
} from '../../../src/prompt-builder/context'

// Helper: render a component inside the provider using SSR
function renderInProvider(
  ui: React.ReactElement,
  providerProps?: Record<string, unknown>,
) {
  const wrapped = createElement(
    PromptBuilderProvider,
    { ...providerProps, children: ui } as React.Attributes & { children: React.ReactNode },
  )
  return renderToString(wrapped)
}

describe('PromptBuilderProvider', () => {
  it('renders children', () => {
    const html = renderInProvider(createElement('div', { 'data-testid': 'child' }, 'Hello'))
    expect(html).toContain('Hello')
  })

  it('provides initial state', () => {
    let captured: unknown[] = []
    function Consumer() {
      const prompts = usePromptBuilderStore((s) => s.prompts)
      captured = prompts
      return createElement('div', null, `count: ${prompts.length}`)
    }

    const html = renderInProvider(createElement(Consumer), {
      initialState: {
        prompts: [
          { id: 'p1', type: 'main', source: 'user', content: 'Test' },
        ],
      },
    })
    expect(html).toContain('count: 1')
    expect(captured).toHaveLength(1)
  })

  it('provides null port when not specified', () => {
    let port: unknown = 'not-null'
    function Consumer() {
      port = usePromptPort()
      return createElement('div', null, 'ok')
    }

    renderInProvider(createElement(Consumer))
    expect(port).toBeNull()
  })

  it('provides the port when specified', () => {
    let port: unknown = null
    function Consumer() {
      port = usePromptPort()
      return createElement('div', null, 'ok')
    }

    const mockPort = {
      loadBlock: () => {},
      clearBlock: () => {},
      refreshBlock: () => {},
      getBlocks: () => [],
      assembleSystemPrompt: () => '',
    }

    renderInProvider(createElement(Consumer), { port: mockPort })
    expect(port).toBe(mockPort)
  })

  it('provides null rules when not specified', () => {
    let rules: unknown = 'not-null'
    function Consumer() {
      rules = useRulesProvider()
      return createElement('div', null, 'ok')
    }

    renderInProvider(createElement(Consumer))
    expect(rules).toBeNull()
  })

  it('provides rules when specified', () => {
    let rules: unknown = null
    function Consumer() {
      rules = useRulesProvider()
      return createElement('div', null, 'ok')
    }

    const mockRules = {
      searchRules: async () => [],
      generateRulesPrompt: async () => null,
      getProjectInfo: async () => null,
      generateProjectPrompt: async () => null,
    }

    renderInProvider(createElement(Consumer), { rules: mockRules })
    expect(rules).toBe(mockRules)
  })
})

describe('usePromptBuilderStore outside provider', () => {
  it('throws when used outside provider', () => {
    function BadConsumer() {
      usePromptBuilderStore((s) => s.prompts)
      return createElement('div', null, 'never')
    }

    expect(() => renderToString(createElement(BadConsumer))).toThrow(
      'usePromptBuilderStore must be used within a PromptBuilderProvider',
    )
  })
})
