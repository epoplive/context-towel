import { describe, it, expect } from 'vitest'
import { createPromptBuilderStore } from '../../../src/prompt-builder/store'
import type { SystemPrompt } from '../../../src/prompt-builder/types'

describe('createPromptBuilderStore', () => {
  it('creates a store with default state', () => {
    const store = createPromptBuilderStore()
    const state = store.getState()

    expect(state.prompts).toEqual([])
    expect(state.chainTemplates).toEqual([])
    expect(state.variableDefinitions).toEqual([])
    expect(state.variableValues).toEqual([])
    expect(state.templates).toEqual([])
    expect(state.userTemplates).toEqual([])
  })

  it('creates a store with initial state', () => {
    const initial = {
      prompts: [
        { id: 'p1', type: 'main' as const, source: 'user' as const, content: 'Hello' },
      ],
    }
    const store = createPromptBuilderStore(initial)
    expect(store.getState().prompts).toHaveLength(1)
    expect(store.getState().prompts[0].content).toBe('Hello')
  })

  describe('prompt actions', () => {
    it('setPrompts replaces all prompts', () => {
      const store = createPromptBuilderStore()
      const prompts: SystemPrompt[] = [
        { id: 'p1', type: 'main', source: 'user', content: 'A' },
        { id: 'p2', type: 'custom', source: 'user', content: 'B' },
      ]
      store.getState().setPrompts(prompts)
      expect(store.getState().prompts).toHaveLength(2)
    })

    it('addPrompt appends a prompt', () => {
      const store = createPromptBuilderStore({
        prompts: [{ id: 'p1', type: 'main', source: 'user', content: 'A' }],
      })
      store.getState().addPrompt({ id: 'p2', type: 'custom', source: 'user', content: 'B' })
      expect(store.getState().prompts).toHaveLength(2)
    })

    it('updatePrompt updates a specific prompt', () => {
      const store = createPromptBuilderStore({
        prompts: [{ id: 'p1', type: 'main', source: 'user', content: 'old' }],
      })
      store.getState().updatePrompt('p1', { content: 'new' })
      expect(store.getState().prompts[0].content).toBe('new')
    })

    it('updatePrompt ignores non-existent ID', () => {
      const store = createPromptBuilderStore({
        prompts: [{ id: 'p1', type: 'main', source: 'user', content: 'old' }],
      })
      store.getState().updatePrompt('nonexistent', { content: 'new' })
      expect(store.getState().prompts[0].content).toBe('old')
    })

    it('removePrompt removes a prompt by ID', () => {
      const store = createPromptBuilderStore({
        prompts: [
          { id: 'p1', type: 'main', source: 'user', content: 'A' },
          { id: 'p2', type: 'custom', source: 'user', content: 'B' },
        ],
      })
      store.getState().removePrompt('p1')
      expect(store.getState().prompts).toHaveLength(1)
      expect(store.getState().prompts[0].id).toBe('p2')
    })
  })

  describe('chain template actions', () => {
    it('setChainTemplates replaces all', () => {
      const store = createPromptBuilderStore()
      store.getState().setChainTemplates([
        { id: 'ct1', name: 'Chain 1', description: 'A chain', prompts: [] },
      ])
      expect(store.getState().chainTemplates).toHaveLength(1)
    })

    it('addChainTemplate appends', () => {
      const store = createPromptBuilderStore()
      store.getState().addChainTemplate({
        id: 'ct1',
        name: 'Chain 1',
        description: 'A chain',
        prompts: [],
      })
      expect(store.getState().chainTemplates).toHaveLength(1)
    })
  })

  describe('template actions', () => {
    it('setTemplates replaces all', () => {
      const store = createPromptBuilderStore()
      store.getState().setTemplates([
        { id: 't1', name: 'T1', description: 'D1', category: 'general', prompt: 'P', version: '1.0.0' },
      ])
      expect(store.getState().templates).toHaveLength(1)
    })

    it('addUserTemplate appends', () => {
      const store = createPromptBuilderStore()
      store.getState().addUserTemplate({
        id: 'u1',
        name: 'User T',
        description: 'D',
        category: 'custom',
        prompt: 'P',
        version: '1.0.0',
        author: 'user',
      })
      expect(store.getState().userTemplates).toHaveLength(1)
    })

    it('removeUserTemplate removes by ID', () => {
      const store = createPromptBuilderStore({
        userTemplates: [
          { id: 'u1', name: 'A', description: '', category: 'custom', prompt: 'P', version: '1.0.0' },
          { id: 'u2', name: 'B', description: '', category: 'custom', prompt: 'P', version: '1.0.0' },
        ],
      })
      store.getState().removeUserTemplate('u1')
      expect(store.getState().userTemplates).toHaveLength(1)
      expect(store.getState().userTemplates[0].id).toBe('u2')
    })

    it('updateUserTemplate updates by ID', () => {
      const store = createPromptBuilderStore({
        userTemplates: [
          { id: 'u1', name: 'Old', description: '', category: 'custom', prompt: 'P', version: '1.0.0' },
        ],
      })
      store.getState().updateUserTemplate('u1', { name: 'New' })
      expect(store.getState().userTemplates[0].name).toBe('New')
      expect(store.getState().userTemplates[0].updatedAt).toBeDefined()
    })
  })

  describe('variable definition actions', () => {
    it('setVariableDefinitions replaces all', () => {
      const store = createPromptBuilderStore()
      store.getState().setVariableDefinitions([
        {
          id: 'v1',
          name: 'var1',
          label: 'Var 1',
          type: 'text',
          scope: 'system',
          createdAt: '',
          updatedAt: '',
        },
      ])
      expect(store.getState().variableDefinitions).toHaveLength(1)
    })

    it('addVariableDefinition appends', () => {
      const store = createPromptBuilderStore()
      store.getState().addVariableDefinition({
        id: 'v1',
        name: 'var1',
        label: 'Var 1',
        type: 'text',
        scope: 'system',
        createdAt: '',
        updatedAt: '',
      })
      expect(store.getState().variableDefinitions).toHaveLength(1)
    })

    it('removeVariableDefinition removes definition and values', () => {
      const store = createPromptBuilderStore({
        variableDefinitions: [
          { id: 'v1', name: 'var1', label: 'Var 1', type: 'text', scope: 'system', createdAt: '', updatedAt: '' },
        ],
        variableValues: [
          { variableId: 'v1', value: 'val', scope: 'system', updatedAt: '' },
          { variableId: 'v2', value: 'keep', scope: 'system', updatedAt: '' },
        ],
      })

      store.getState().removeVariableDefinition('v1')
      expect(store.getState().variableDefinitions).toHaveLength(0)
      expect(store.getState().variableValues).toHaveLength(1)
      expect(store.getState().variableValues[0].variableId).toBe('v2')
    })
  })

  describe('variable value actions', () => {
    it('setVariableValues replaces all', () => {
      const store = createPromptBuilderStore()
      store.getState().setVariableValues([
        { variableId: 'v1', value: 'a', scope: 'system', updatedAt: '' },
      ])
      expect(store.getState().variableValues).toHaveLength(1)
    })
  })
})
