import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { darkTheme, lightTheme } from '@context-towel/context-graph/compat/design-system'
import type { Theme } from '@context-towel/context-graph/compat/design-system'

export type ThemePreference = 'dark' | 'light' | 'system'

interface ThemeStore {
  preference: ThemePreference
  /** Resolved theme based on preference + system setting */
  resolved: Theme
  setPreference: (pref: ThemePreference) => void
}

function resolveTheme(pref: ThemePreference): Theme {
  if (pref === 'dark') return darkTheme
  if (pref === 'light') return lightTheme
  // system
  if (typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: light)').matches) {
    return lightTheme
  }
  return darkTheme
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      preference: 'dark',
      resolved: darkTheme,
      setPreference: (pref: ThemePreference) => {
        set({ preference: pref, resolved: resolveTheme(pref) })
      },
    }),
    {
      name: 'context-towel-theme',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ preference: state.preference }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.resolved = resolveTheme(state.preference)
        }
      },
    }
  )
)

// Listen for system theme changes and update if preference is 'system'
if (typeof window !== 'undefined') {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  mq.addEventListener('change', () => {
    const { preference } = useThemeStore.getState()
    if (preference === 'system') {
      useThemeStore.setState({ resolved: resolveTheme('system') })
    }
  })
}
