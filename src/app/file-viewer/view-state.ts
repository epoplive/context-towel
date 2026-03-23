import { create } from 'zustand'
import type { ViewMode } from './types'

// Shared state so accordion header controls and FileViewerInner content stay in sync
interface EmbeddedViewState {
  modes: Record<string, ViewMode>
  plans: Record<string, boolean>
  setMode: (fp: string, mode: ViewMode) => void
  setPlan: (fp: string, isPlan: boolean) => void
}

export const useEmbeddedViewState = create<EmbeddedViewState>((set) => ({
  modes: {},
  plans: {},
  setMode: (fp, mode) => set(s => ({ modes: { ...s.modes, [fp]: mode } })),
  setPlan: (fp, isPlan) => set(s => ({ plans: { ...s.plans, [fp]: isPlan } })),
}))
