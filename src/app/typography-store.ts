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

const TYPOGRAPHY_STYLE_ID = 'context-towel-typography-vars'

/**
 * Apply all typography CSS variables via a <style> tag instead of
 * inline styles on <html>. WKWebView's print engine captures <style>
 * tags but may not capture programmatic element.style properties.
 */
function applyTypographyStyleTag(
  primaryFont: string,
  monoFont: string,
  fontSize: number,
  lineHeight: number,
  monoLineHeight: number,
  letterSpacing: number,
  fontSmoothing: FontSmoothing,
  textRendering: TextRendering,
  fontWeight: number,
) {
  let el = document.getElementById(TYPOGRAPHY_STYLE_ID) as HTMLStyleElement | null
  if (!el) {
    el = document.createElement('style')
    el.id = TYPOGRAPHY_STYLE_ID
    document.head.appendChild(el)
  }

  const vars: string[] = []
  if (primaryFont.trim()) vars.push(`--font-primary: ${primaryFont.trim()};`)
  if (monoFont.trim()) vars.push(`--font-mono: ${monoFont.trim()};`)
  if (fontSize !== 14) vars.push(`--font-size-base: ${fontSize}px;`)
  if (lineHeight !== 1.5) vars.push(`--line-height-base: ${lineHeight};`)
  if (monoLineHeight !== 1.0) vars.push(`--line-height-mono: ${monoLineHeight};`)
  if (letterSpacing !== 0) vars.push(`--letter-spacing-base: ${letterSpacing}em;`)
  if (fontWeight !== 400) vars.push(`--font-weight-base: ${fontWeight};`)
  vars.push(`--font-smoothing-webkit: ${
    fontSmoothing === 'antialiased' ? 'antialiased' :
    fontSmoothing === 'subpixel' ? 'subpixel-antialiased' : 'auto'
  };`)
  vars.push(`--font-smoothing-moz: ${fontSmoothing === 'antialiased' ? 'grayscale' : 'auto'};`)
  vars.push(`--text-rendering: ${textRendering};`)

  el.textContent = `:root { ${vars.join(' ')} }`
}

function applyFontsToDOM(primaryFont: string, monoFont: string) {
  // Read current full state to rebuild the style tag
  const s = currentTypographySnapshot
  applyTypographyStyleTag(primaryFont, monoFont, s.fontSize, s.lineHeight, s.monoLineHeight, s.letterSpacing, s.fontSmoothing, s.textRendering, s.fontWeight)
}

function applyTypographyToDOM(fontSize: number, lineHeight: number, monoLineHeight: number, letterSpacing: number) {
  const s = currentTypographySnapshot
  applyTypographyStyleTag(s.primaryFont, s.monoFont, fontSize, lineHeight, monoLineHeight, letterSpacing, s.fontSmoothing, s.textRendering, s.fontWeight)
}

function applyFontRenderingToDOM(fontSmoothing: FontSmoothing, textRendering: TextRendering, fontWeight: number) {
  const s = currentTypographySnapshot
  applyTypographyStyleTag(s.primaryFont, s.monoFont, s.fontSize, s.lineHeight, s.monoLineHeight, s.letterSpacing, fontSmoothing, textRendering, fontWeight)
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
      onRehydrateStorage: () => (state) => {
        if (!state) return
        applyTypographyStyleTag(
          state.primaryFont, state.monoFont,
          state.fontSize, state.lineHeight, state.monoLineHeight, state.letterSpacing,
          state.fontSmoothing, state.textRendering, state.fontWeight,
        )
        loadSavedFonts(state.primaryFont, state.monoFont)
      },
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

  // Re-apply to DOM whenever store changes (including hydration from localStorage)
  applyTypographyStyleTag(
    state.primaryFont, state.monoFont,
    state.fontSize, state.lineHeight, state.monoLineHeight, state.letterSpacing,
    state.fontSmoothing, state.textRendering, state.fontWeight,
  )
  loadSavedFonts(state.primaryFont, state.monoFont)
})

export function readTypographySnapshot(): TypographySnapshot {
  return currentTypographySnapshot
}

/**
 * Initialize typography settings on app load.
 * Reads directly from localStorage to avoid zustand hydration timing issues.
 */
export function initTypography() {
  let state: TypographySnapshot | null = null
  try {
    const raw = localStorage.getItem('context-towel-typography')
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed?.state) state = parsed.state as TypographySnapshot
    }
  } catch { /* ignore */ }

  if (!state) state = readTypographySnapshot()

  applyTypographyStyleTag(
    state.primaryFont, state.monoFont,
    state.fontSize, state.lineHeight, state.monoLineHeight, state.letterSpacing,
    state.fontSmoothing, state.textRendering, state.fontWeight,
  )
  loadSavedFonts(state.primaryFont, state.monoFont)
}
