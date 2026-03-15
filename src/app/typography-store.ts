import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { MONO_FONTS, SANS_FONTS, loadFont } from './fonts'

export type FontSmoothing = 'auto' | 'antialiased' | 'subpixel'
export type TextRendering = 'auto' | 'optimizeSpeed' | 'optimizeLegibility' | 'geometricPrecision'

interface TypographyStore {
  primaryFont: string
  monoFont: string
  fontSize: number
  lineHeight: number
  monoLineHeight: number
  letterSpacing: number
  fontSmoothing: FontSmoothing
  textRendering: TextRendering
  fontWeight: number
  setPrimaryFont: (font: string) => void
  setMonoFont: (font: string) => void
  setFontSize: (size: number) => void
  setLineHeight: (height: number) => void
  setMonoLineHeight: (height: number) => void
  setLetterSpacing: (spacing: number) => void
  setFontSmoothing: (smoothing: FontSmoothing) => void
  setTextRendering: (rendering: TextRendering) => void
  setFontWeight: (weight: number) => void
}

type TypographySnapshot = Pick<
  TypographyStore,
  | 'primaryFont'
  | 'monoFont'
  | 'fontSize'
  | 'lineHeight'
  | 'monoLineHeight'
  | 'letterSpacing'
  | 'fontSmoothing'
  | 'textRendering'
  | 'fontWeight'
>

function applyFontsToDOM(primaryFont: string, monoFont: string) {
  const root = document.documentElement

  if (primaryFont.trim()) {
    root.style.setProperty('--font-primary', primaryFont.trim())
  } else {
    root.style.removeProperty('--font-primary')
  }

  if (monoFont.trim()) {
    root.style.setProperty('--font-mono', monoFont.trim())
  } else {
    root.style.removeProperty('--font-mono')
  }
}

function applyTypographyToDOM(fontSize: number, lineHeight: number, monoLineHeight: number, letterSpacing: number) {
  const root = document.documentElement

  if (fontSize !== 14) {
    root.style.setProperty('--font-size-base', `${fontSize}px`)
  } else {
    root.style.removeProperty('--font-size-base')
  }

  if (lineHeight !== 1.5) {
    root.style.setProperty('--line-height-base', `${lineHeight}`)
  } else {
    root.style.removeProperty('--line-height-base')
  }

  if (monoLineHeight !== 1.0) {
    root.style.setProperty('--line-height-mono', `${monoLineHeight}`)
  } else {
    root.style.removeProperty('--line-height-mono')
  }

  if (letterSpacing !== 0) {
    root.style.setProperty('--letter-spacing-base', `${letterSpacing}em`)
  } else {
    root.style.removeProperty('--letter-spacing-base')
  }
}

function applyFontRenderingToDOM(fontSmoothing: FontSmoothing, textRendering: TextRendering, fontWeight: number) {
  const root = document.documentElement

  root.style.setProperty('--font-smoothing-webkit',
    fontSmoothing === 'antialiased' ? 'antialiased' :
    fontSmoothing === 'subpixel' ? 'subpixel-antialiased' : 'auto'
  )
  root.style.setProperty('--font-smoothing-moz',
    fontSmoothing === 'antialiased' ? 'grayscale' : 'auto'
  )

  root.style.setProperty('--text-rendering', textRendering)

  if (fontWeight !== 400) {
    root.style.setProperty('--font-weight-base', `${fontWeight}`)
  } else {
    root.style.removeProperty('--font-weight-base')
  }
}

async function loadSavedFonts(primaryFont: string, monoFont: string) {
  if (primaryFont) {
    const sansFont = SANS_FONTS.find(f => f.cssValue === primaryFont)
    if (sansFont && sansFont.googleFontFamily) {
      loadFont(sansFont).catch(e => console.warn('Failed to load primary font:', e))
    }
  }

  if (monoFont) {
    const monoFontConfig = MONO_FONTS.find(f => f.cssValue === monoFont)
    if (monoFontConfig && monoFontConfig.googleFontFamily) {
      loadFont(monoFontConfig).catch(e => console.warn('Failed to load mono font:', e))
    }
  }
}

export const useTypographyStore = create<TypographyStore>()(
  persist(
    (set, get) => ({
      primaryFont: '',
      monoFont: '',
      fontSize: 14,
      lineHeight: 1.5,
      monoLineHeight: 1.0,
      letterSpacing: 0,
      fontSmoothing: 'antialiased',
      textRendering: 'optimizeLegibility',
      fontWeight: 400,

      setPrimaryFont: (font: string) => {
        set({ primaryFont: font })
        applyFontsToDOM(font, get().monoFont)
      },

      setMonoFont: (font: string) => {
        set({ monoFont: font })
        applyFontsToDOM(get().primaryFont, font)
      },

      setFontSize: (size: number) => {
        set({ fontSize: size })
        applyTypographyToDOM(size, get().lineHeight, get().monoLineHeight, get().letterSpacing)
      },

      setLineHeight: (height: number) => {
        set({ lineHeight: height })
        applyTypographyToDOM(get().fontSize, height, get().monoLineHeight, get().letterSpacing)
      },

      setMonoLineHeight: (height: number) => {
        set({ monoLineHeight: height })
        applyTypographyToDOM(get().fontSize, get().lineHeight, height, get().letterSpacing)
      },

      setLetterSpacing: (spacing: number) => {
        set({ letterSpacing: spacing })
        applyTypographyToDOM(get().fontSize, get().lineHeight, get().monoLineHeight, spacing)
      },

      setFontSmoothing: (smoothing: FontSmoothing) => {
        set({ fontSmoothing: smoothing })
        applyFontRenderingToDOM(smoothing, get().textRendering, get().fontWeight)
      },

      setTextRendering: (rendering: TextRendering) => {
        set({ textRendering: rendering })
        applyFontRenderingToDOM(get().fontSmoothing, rendering, get().fontWeight)
      },

      setFontWeight: (weight: number) => {
        set({ fontWeight: weight })
        applyFontRenderingToDOM(get().fontSmoothing, get().textRendering, weight)
      },
    }),
    {
      name: 'context-towel-typography',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        primaryFont: state.primaryFont,
        monoFont: state.monoFont,
        fontSize: state.fontSize,
        lineHeight: state.lineHeight,
        monoLineHeight: state.monoLineHeight,
        letterSpacing: state.letterSpacing,
        fontSmoothing: state.fontSmoothing,
        textRendering: state.textRendering,
        fontWeight: state.fontWeight,
      }),
    }
  )
)

let currentTypographySnapshot: TypographySnapshot = {
  primaryFont: '',
  monoFont: '',
  fontSize: 14,
  lineHeight: 1.5,
  monoLineHeight: 1.0,
  letterSpacing: 0,
  fontSmoothing: 'antialiased',
  textRendering: 'optimizeLegibility',
  fontWeight: 400,
}

useTypographyStore.subscribe((state) => {
  currentTypographySnapshot = {
    primaryFont: state.primaryFont,
    monoFont: state.monoFont,
    fontSize: state.fontSize,
    lineHeight: state.lineHeight,
    monoLineHeight: state.monoLineHeight,
    letterSpacing: state.letterSpacing,
    fontSmoothing: state.fontSmoothing,
    textRendering: state.textRendering,
    fontWeight: state.fontWeight,
  }
})

export function readTypographySnapshot(): TypographySnapshot {
  return currentTypographySnapshot
}

/**
 * Initialize typography settings on app load.
 * Call this once from your app entry point.
 */
export function initTypography() {
  const state = readTypographySnapshot()
  applyFontsToDOM(state.primaryFont, state.monoFont)
  applyTypographyToDOM(state.fontSize, state.lineHeight, state.monoLineHeight, state.letterSpacing)
  applyFontRenderingToDOM(state.fontSmoothing, state.textRendering, state.fontWeight)
  loadSavedFonts(state.primaryFont, state.monoFont)
}
