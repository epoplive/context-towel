/**
 * Prompt builder Zustand store.
 *
 * Standalone store that manages prompt builder state.
 * Uses the Zustand "vanilla" store pattern so it can be
 * provided via React context (one store per provider instance).
 */

import { createStore, type StoreApi } from 'zustand/vanilla'
import type {
  SystemPrompt,
  VersionedTemplate,
  VariableDefinition,
  VariableValue,
  PromptChainTemplate,
} from './types'

// ---------------------------------------------------------------------------
// Store state shape
// ---------------------------------------------------------------------------

export interface PromptBuilderSnapshot {
  prompts: SystemPrompt[]
  chainTemplates: PromptChainTemplate[]
  variableDefinitions: VariableDefinition[]
  variableValues: VariableValue[]
  templates: VersionedTemplate[]
  userTemplates: VersionedTemplate[]
}

export interface PromptBuilderActions {
  setPrompts: (prompts: SystemPrompt[]) => void
  addPrompt: (prompt: SystemPrompt) => void
  updatePrompt: (id: string, updates: Partial<SystemPrompt>) => void
  removePrompt: (id: string) => void

  setChainTemplates: (templates: PromptChainTemplate[]) => void
  addChainTemplate: (template: PromptChainTemplate) => void

  setTemplates: (templates: VersionedTemplate[]) => void
  addUserTemplate: (template: VersionedTemplate) => void
  removeUserTemplate: (id: string) => void
  updateUserTemplate: (id: string, updates: Partial<VersionedTemplate>) => void

  setVariableDefinitions: (definitions: VariableDefinition[]) => void
  addVariableDefinition: (definition: VariableDefinition) => void
  removeVariableDefinition: (id: string) => void

  setVariableValues: (values: VariableValue[]) => void
}

export type PromptBuilderState = PromptBuilderSnapshot & PromptBuilderActions

// ---------------------------------------------------------------------------
// Store factory
// ---------------------------------------------------------------------------

export function createPromptBuilderStore(
  initialState?: Partial<PromptBuilderSnapshot>,
): StoreApi<PromptBuilderState> {
  return createStore<PromptBuilderState>((set) => ({
    // Initial state
    prompts: initialState?.prompts ?? [],
    chainTemplates: initialState?.chainTemplates ?? [],
    variableDefinitions: initialState?.variableDefinitions ?? [],
    variableValues: initialState?.variableValues ?? [],
    templates: initialState?.templates ?? [],
    userTemplates: initialState?.userTemplates ?? [],

    // Prompt actions
    setPrompts: (prompts) => set({ prompts }),
    addPrompt: (prompt) => set((s) => ({ prompts: [...s.prompts, prompt] })),
    updatePrompt: (id, updates) =>
      set((s) => ({
        prompts: s.prompts.map((p) => (p.id === id ? { ...p, ...updates } : p)),
      })),
    removePrompt: (id) => set((s) => ({ prompts: s.prompts.filter((p) => p.id !== id) })),

    // Chain template actions
    setChainTemplates: (templates) => set({ chainTemplates: templates }),
    addChainTemplate: (template) =>
      set((s) => ({ chainTemplates: [...s.chainTemplates, template] })),

    // Template actions
    setTemplates: (templates) => set({ templates }),
    addUserTemplate: (template) =>
      set((s) => ({ userTemplates: [...s.userTemplates, template] })),
    removeUserTemplate: (id) =>
      set((s) => ({ userTemplates: s.userTemplates.filter((t) => t.id !== id) })),
    updateUserTemplate: (id, updates) =>
      set((s) => ({
        userTemplates: s.userTemplates.map((t) =>
          t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t,
        ),
      })),

    // Variable definition actions
    setVariableDefinitions: (definitions) => set({ variableDefinitions: definitions }),
    addVariableDefinition: (definition) =>
      set((s) => ({ variableDefinitions: [...s.variableDefinitions, definition] })),
    removeVariableDefinition: (id) =>
      set((s) => ({
        variableDefinitions: s.variableDefinitions.filter((v) => v.id !== id),
        variableValues: s.variableValues.filter((v) => v.variableId !== id),
      })),

    // Variable value actions
    setVariableValues: (values) => set({ variableValues: values }),
  }))
}
