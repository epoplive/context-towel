import { useEffect, useRef } from 'react'

export interface GraphShortcutActions {
  panUp: () => void
  panDown: () => void
  panLeft: () => void
  panRight: () => void
  fastPanUp: () => void
  fastPanDown: () => void
  fastPanLeft: () => void
  fastPanRight: () => void
  zoomIn: () => void
  zoomOut: () => void
  fitView: () => void
  increaseCardScale: () => void
  decreaseCardScale: () => void
  nextNode: () => void
  prevNode: () => void
  zoomToNode: () => void
}

export type RegisterGraphShortcuts = (actions: GraphShortcutActions, ownerId?: string) => () => void

export interface ScopeManagerLike {
  push(scope: string): void
  remove(scope: string): boolean
}

let registerGraphShortcutsImpl: RegisterGraphShortcuts | null = null
let scopeManagerImpl: ScopeManagerLike | null = null

export function configureGraphShortcuts(register: RegisterGraphShortcuts | null): void {
  registerGraphShortcutsImpl = register
}

export function configureScopeManager(manager: ScopeManagerLike | null): void {
  scopeManagerImpl = manager
}

/** Compat scopeManager (defaults to no-op). */
export const scopeManager = {
  push(scope: string): void {
    scopeManagerImpl?.push(scope)
  },
  remove(scope: string): boolean {
    return scopeManagerImpl?.remove(scope) ?? false
  },
} as const

/**
 * Hook to register graph shortcuts with the host's keybinding system.
 * Defaults to a no-op when no host adapter is configured.
 */
export function useGraphShortcuts(actions: GraphShortcutActions, ownerId = 'DocumentGraph'): void {
  const actionsRef = useRef(actions)
  actionsRef.current = actions

  useEffect(() => {
    if (!registerGraphShortcutsImpl) return

    const wrapped: GraphShortcutActions = {
      panUp: () => actionsRef.current.panUp(),
      panDown: () => actionsRef.current.panDown(),
      panLeft: () => actionsRef.current.panLeft(),
      panRight: () => actionsRef.current.panRight(),
      fastPanUp: () => actionsRef.current.fastPanUp(),
      fastPanDown: () => actionsRef.current.fastPanDown(),
      fastPanLeft: () => actionsRef.current.fastPanLeft(),
      fastPanRight: () => actionsRef.current.fastPanRight(),
      zoomIn: () => actionsRef.current.zoomIn(),
      zoomOut: () => actionsRef.current.zoomOut(),
      fitView: () => actionsRef.current.fitView(),
      increaseCardScale: () => actionsRef.current.increaseCardScale(),
      decreaseCardScale: () => actionsRef.current.decreaseCardScale(),
      nextNode: () => actionsRef.current.nextNode(),
      prevNode: () => actionsRef.current.prevNode(),
      zoomToNode: () => actionsRef.current.zoomToNode(),
    }

    return registerGraphShortcutsImpl(wrapped, ownerId)
  }, []) // actions accessed via ref
}

