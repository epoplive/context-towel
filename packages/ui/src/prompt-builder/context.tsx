/**
 * PromptBuilderProvider - React context for the prompt builder.
 *
 * Provides a Zustand store instance and optional integrations
 * (PromptManagementPort, RulesProvider) to all child components.
 *
 * Usage:
 *   <PromptBuilderProvider port={myPort} rules={myRulesProvider}>
 *     <PromptBuilder ... />
 *   </PromptBuilderProvider>
 */

import { createContext, useContext, useRef, type ReactNode } from 'react'
import { useStore, type StoreApi } from 'zustand'
import {
  createPromptBuilderStore,
  type PromptBuilderState,
  type PromptBuilderSnapshot,
} from './store'
import type { RulesProvider } from './types'

// ---------------------------------------------------------------------------
// PromptManagementPort re-export from @context-towel/core contract
// ---------------------------------------------------------------------------

/**
 * Minimal port interface for prompt block management.
 * Structurally matches @context-towel/core PromptManagementPort.
 */
export interface PromptManagementPort {
  loadBlock(id: string, content: string, options?: { priority?: string }): void
  clearBlock(id: string): void
  refreshBlock(id: string, content: string): void
  getBlocks(): Array<{ id: string; content: string; priority: string; addedAt: string }>
  assembleSystemPrompt(): string
}

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

interface PromptBuilderContextValue {
  store: StoreApi<PromptBuilderState>
  port: PromptManagementPort | null
  rules: RulesProvider | null
}

const PromptBuilderContext = createContext<PromptBuilderContextValue | null>(null)

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export interface PromptBuilderProviderProps {
  children: ReactNode
  /** Optional PromptManagementPort for block-level prompt management. */
  port?: PromptManagementPort
  /** Optional RulesProvider for code indexer rules integration. */
  rules?: RulesProvider
  /** Initial state to hydrate the store with. */
  initialState?: Partial<PromptBuilderSnapshot>
}

export function PromptBuilderProvider({
  children,
  port,
  rules,
  initialState,
}: PromptBuilderProviderProps) {
  const storeRef = useRef<StoreApi<PromptBuilderState> | null>(null)
  if (storeRef.current === null) {
    storeRef.current = createPromptBuilderStore(initialState)
  }

  return (
    <PromptBuilderContext.Provider
      value={{
        store: storeRef.current,
        port: port ?? null,
        rules: rules ?? null,
      }}
    >
      {children}
    </PromptBuilderContext.Provider>
  )
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

function usePromptBuilderContext(): PromptBuilderContextValue {
  const ctx = useContext(PromptBuilderContext)
  if (!ctx) {
    throw new Error('usePromptBuilderStore must be used within a PromptBuilderProvider')
  }
  return ctx
}

/**
 * Selects state from the prompt builder store.
 */
export function usePromptBuilderStore<T>(selector: (state: PromptBuilderState) => T): T {
  const { store } = usePromptBuilderContext()
  return useStore(store, selector)
}

/**
 * Returns the PromptManagementPort (or null if not provided).
 */
export function usePromptPort(): PromptManagementPort | null {
  const { port } = usePromptBuilderContext()
  return port
}

/**
 * Returns the RulesProvider (or null if not provided).
 */
export function useRulesProvider(): RulesProvider | null {
  const { rules } = usePromptBuilderContext()
  return rules
}
