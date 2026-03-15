/**
 * Font loader utility - loads fonts from Google Fonts
 *
 * Fonts are downloaded and cached by the browser for local use.
 */

export interface FontConfig {
  id: string
  name: string
  googleFontFamily: string // e.g., 'JetBrains+Mono:wght@400;500;600;700'
  cssValue: string // The CSS font-family value with fallbacks
  category: 'mono' | 'sans' | 'serif'
  weights?: string[] // e.g., ['400', '500', '600', '700']
  isVariable?: boolean // Variable font support
  description?: string // Short description of the font
  hasLigatures?: boolean // Programming ligatures support
}

// Monospace fonts for code/terminal - comprehensive list
export const MONO_FONTS: FontConfig[] = [
  // System fonts (no download needed)
  {
    id: 'system-mono',
    name: 'System Mono',
    googleFontFamily: '',
    cssValue: "ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
    category: 'mono',
    description: 'Native system monospace font',
  },
  {
    id: 'sf-mono',
    name: 'SF Mono',
    googleFontFamily: '',
    cssValue: "'SF Mono', SFMono-Regular, ui-monospace, Menlo, Monaco, Consolas, monospace",
    category: 'mono',
    description: 'Apple San Francisco Mono (macOS/iOS)',
  },
  {
    id: 'menlo',
    name: 'Menlo',
    googleFontFamily: '',
    cssValue: "Menlo, Monaco, 'Courier New', monospace",
    category: 'mono',
    description: 'Classic macOS monospace font',
  },
  {
    id: 'consolas',
    name: 'Consolas',
    googleFontFamily: '',
    cssValue: "Consolas, 'Courier New', monospace",
    category: 'mono',
    description: 'Windows developer font',
  },
  {
    id: 'cascadia-code',
    name: 'Cascadia Code',
    googleFontFamily: '',
    cssValue: "'Cascadia Code', 'Cascadia Mono', ui-monospace, monospace",
    category: 'mono',
    description: 'Microsoft terminal font with ligatures',
    hasLigatures: true,
  },

  // Google Fonts - Popular coding fonts
  {
    id: 'jetbrains-mono',
    name: 'JetBrains Mono',
    googleFontFamily: 'JetBrains+Mono:ital,wght@0,400;0,500;0,600;0,700;1,400',
    cssValue: "'JetBrains Mono', ui-monospace, monospace",
    category: 'mono',
    weights: ['400', '500', '600', '700'],
    description: 'Designed for developers, excellent readability',
    hasLigatures: true,
  },
  {
    id: 'fira-code',
    name: 'Fira Code',
    googleFontFamily: 'Fira+Code:wght@400;500;600;700',
    cssValue: "'Fira Code', ui-monospace, monospace",
    category: 'mono',
    weights: ['400', '500', '600', '700'],
    description: 'Popular coding font with extensive ligatures',
    hasLigatures: true,
  },
  {
    id: 'source-code-pro',
    name: 'Source Code Pro',
    googleFontFamily: 'Source+Code+Pro:ital,wght@0,400;0,500;0,600;0,700;1,400',
    cssValue: "'Source Code Pro', ui-monospace, monospace",
    category: 'mono',
    weights: ['400', '500', '600', '700'],
    description: 'Adobe open source monospace',
  },
  {
    id: 'ibm-plex-mono',
    name: 'IBM Plex Mono',
    googleFontFamily: 'IBM+Plex+Mono:ital,wght@0,400;0,500;0,600;0,700;1,400',
    cssValue: "'IBM Plex Mono', ui-monospace, monospace",
    category: 'mono',
    weights: ['400', '500', '600', '700'],
    description: 'IBM corporate font family, modern and clean',
  },
  {
    id: 'roboto-mono',
    name: 'Roboto Mono',
    googleFontFamily: 'Roboto+Mono:ital,wght@0,400;0,500;0,600;0,700;1,400',
    cssValue: "'Roboto Mono', ui-monospace, monospace",
    category: 'mono',
    weights: ['400', '500', '600', '700'],
    description: 'Monospace version of Google Roboto',
  },
  {
    id: 'ubuntu-mono',
    name: 'Ubuntu Mono',
    googleFontFamily: 'Ubuntu+Mono:ital,wght@0,400;0,700;1,400',
    cssValue: "'Ubuntu Mono', ui-monospace, monospace",
    category: 'mono',
    weights: ['400', '700'],
    description: 'Ubuntu Linux system font',
  },
  {
    id: 'inconsolata',
    name: 'Inconsolata',
    googleFontFamily: 'Inconsolata:wght@400;500;600;700',
    cssValue: "'Inconsolata', ui-monospace, monospace",
    category: 'mono',
    weights: ['400', '500', '600', '700'],
    description: 'Clean humanist monospace',
  },
  {
    id: 'fira-mono',
    name: 'Fira Mono',
    googleFontFamily: 'Fira+Mono:wght@400;500;700',
    cssValue: "'Fira Mono', ui-monospace, monospace",
    category: 'mono',
    weights: ['400', '500', '700'],
    description: 'Mozilla Fira family, no ligatures',
  },
  {
    id: 'space-mono',
    name: 'Space Mono',
    googleFontFamily: 'Space+Mono:ital,wght@0,400;0,700;1,400',
    cssValue: "'Space Mono', ui-monospace, monospace",
    category: 'mono',
    weights: ['400', '700'],
    description: 'Quirky geometric monospace',
  },
  {
    id: 'dm-mono',
    name: 'DM Mono',
    googleFontFamily: 'DM+Mono:ital,wght@0,400;0,500;1,400',
    cssValue: "'DM Mono', ui-monospace, monospace",
    category: 'mono',
    weights: ['400', '500'],
    description: 'Low contrast, comfortable reading',
  },
  {
    id: 'cousine',
    name: 'Cousine',
    googleFontFamily: 'Cousine:ital,wght@0,400;0,700;1,400',
    cssValue: "'Cousine', ui-monospace, monospace",
    category: 'mono',
    weights: ['400', '700'],
    description: 'Courier New alternative',
  },
  {
    id: 'anonymous-pro',
    name: 'Anonymous Pro',
    googleFontFamily: 'Anonymous+Pro:ital,wght@0,400;0,700;1,400',
    cssValue: "'Anonymous Pro', ui-monospace, monospace",
    category: 'mono',
    weights: ['400', '700'],
    description: 'Designed for coders, clear character distinction',
  },
  {
    id: 'overpass-mono',
    name: 'Overpass Mono',
    googleFontFamily: 'Overpass+Mono:wght@400;500;600;700',
    cssValue: "'Overpass Mono', ui-monospace, monospace",
    category: 'mono',
    weights: ['400', '500', '600', '700'],
    description: 'Red Hat inspired open source font',
  },
  {
    id: 'red-hat-mono',
    name: 'Red Hat Mono',
    googleFontFamily: 'Red+Hat+Mono:ital,wght@0,400;0,500;0,600;0,700;1,400',
    cssValue: "'Red Hat Mono', ui-monospace, monospace",
    category: 'mono',
    weights: ['400', '500', '600', '700'],
    description: 'Red Hat corporate font',
  },
  {
    id: 'azeret-mono',
    name: 'Azeret Mono',
    googleFontFamily: 'Azeret+Mono:ital,wght@0,400;0,500;0,600;0,700;1,400',
    cssValue: "'Azeret Mono', ui-monospace, monospace",
    category: 'mono',
    weights: ['400', '500', '600', '700'],
    description: 'Modern geometric monospace',
  },
  {
    id: 'martian-mono',
    name: 'Martian Mono',
    googleFontFamily: 'Martian+Mono:wght@400;500;600;700',
    cssValue: "'Martian Mono', ui-monospace, monospace",
    category: 'mono',
    weights: ['400', '500', '600', '700'],
    description: 'Free grotesque variable-width monospace',
  },
  {
    id: 'noto-sans-mono',
    name: 'Noto Sans Mono',
    googleFontFamily: 'Noto+Sans+Mono:wght@400;500;600;700',
    cssValue: "'Noto Sans Mono', ui-monospace, monospace",
    category: 'mono',
    weights: ['400', '500', '600', '700'],
    description: 'Google Noto family, wide language support',
  },
  {
    id: 'share-tech-mono',
    name: 'Share Tech Mono',
    googleFontFamily: 'Share+Tech+Mono',
    cssValue: "'Share Tech Mono', ui-monospace, monospace",
    category: 'mono',
    weights: ['400'],
    description: 'Technical, industrial feel',
  },
  {
    id: 'nova-mono',
    name: 'Nova Mono',
    googleFontFamily: 'Nova+Mono',
    cssValue: "'Nova Mono', ui-monospace, monospace",
    category: 'mono',
    weights: ['400'],
    description: 'Casual handwritten style',
  },
]

// Sans-serif fonts for UI - comprehensive list
export const SANS_FONTS: FontConfig[] = [
  // System fonts (no download needed)
  {
    id: 'system-ui',
    name: 'System UI',
    googleFontFamily: '',
    cssValue: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    category: 'sans',
    description: 'Native system font for each OS',
  },
  {
    id: 'sf-pro',
    name: 'SF Pro',
    googleFontFamily: '',
    cssValue: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'SF Pro Display', sans-serif",
    category: 'sans',
    description: 'Apple San Francisco (macOS/iOS)',
  },
  {
    id: 'segoe-ui',
    name: 'Segoe UI',
    googleFontFamily: '',
    cssValue: "'Segoe UI', system-ui, sans-serif",
    category: 'sans',
    description: 'Microsoft Windows system font',
  },
  {
    id: 'helvetica-neue',
    name: 'Helvetica Neue',
    googleFontFamily: '',
    cssValue: "'Helvetica Neue', Helvetica, Arial, sans-serif",
    category: 'sans',
    description: 'Classic Swiss typeface',
  },

  // Google Fonts - Popular UI fonts
  {
    id: 'inter',
    name: 'Inter',
    googleFontFamily: 'Inter:wght@400;500;600;700',
    cssValue: "'Inter', system-ui, sans-serif",
    category: 'sans',
    weights: ['400', '500', '600', '700'],
    isVariable: true,
    description: 'Designed for screens, used by GitHub & Figma',
  },
  {
    id: 'roboto',
    name: 'Roboto',
    googleFontFamily: 'Roboto:ital,wght@0,400;0,500;0,700;1,400',
    cssValue: "'Roboto', system-ui, sans-serif",
    category: 'sans',
    weights: ['400', '500', '700'],
    description: 'Google Material Design font',
  },
  {
    id: 'open-sans',
    name: 'Open Sans',
    googleFontFamily: 'Open+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400',
    cssValue: "'Open Sans', system-ui, sans-serif",
    category: 'sans',
    weights: ['400', '500', '600', '700'],
    description: 'Friendly and neutral, very readable',
  },
  {
    id: 'ibm-plex-sans',
    name: 'IBM Plex Sans',
    googleFontFamily: 'IBM+Plex+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400',
    cssValue: "'IBM Plex Sans', system-ui, sans-serif",
    category: 'sans',
    weights: ['400', '500', '600', '700'],
    description: 'IBM corporate font, modern and professional',
  },
  {
    id: 'nunito',
    name: 'Nunito',
    googleFontFamily: 'Nunito:ital,wght@0,400;0,500;0,600;0,700;1,400',
    cssValue: "'Nunito', system-ui, sans-serif",
    category: 'sans',
    weights: ['400', '500', '600', '700'],
    description: 'Rounded terminals, friendly appearance',
  },
  {
    id: 'nunito-sans',
    name: 'Nunito Sans',
    googleFontFamily: 'Nunito+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400',
    cssValue: "'Nunito Sans', system-ui, sans-serif",
    category: 'sans',
    weights: ['400', '500', '600', '700'],
    description: 'Sans version without rounded terminals',
  },
  {
    id: 'lato',
    name: 'Lato',
    googleFontFamily: 'Lato:ital,wght@0,400;0,700;1,400',
    cssValue: "'Lato', system-ui, sans-serif",
    category: 'sans',
    weights: ['400', '700'],
    description: 'Warm, stable, professional',
  },
  {
    id: 'source-sans-3',
    name: 'Source Sans 3',
    googleFontFamily: 'Source+Sans+3:ital,wght@0,400;0,500;0,600;0,700;1,400',
    cssValue: "'Source Sans 3', system-ui, sans-serif",
    category: 'sans',
    weights: ['400', '500', '600', '700'],
    description: 'Adobe open source, excellent readability',
  },
  {
    id: 'dm-sans',
    name: 'DM Sans',
    googleFontFamily: 'DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400',
    cssValue: "'DM Sans', system-ui, sans-serif",
    category: 'sans',
    weights: ['400', '500', '600', '700'],
    description: 'Low contrast geometric, clean UI font',
  },
  {
    id: 'poppins',
    name: 'Poppins',
    googleFontFamily: 'Poppins:ital,wght@0,400;0,500;0,600;0,700;1,400',
    cssValue: "'Poppins', system-ui, sans-serif",
    category: 'sans',
    weights: ['400', '500', '600', '700'],
    description: 'Geometric with balanced curves',
  },
  {
    id: 'montserrat',
    name: 'Montserrat',
    googleFontFamily: 'Montserrat:ital,wght@0,400;0,500;0,600;0,700;1,400',
    cssValue: "'Montserrat', system-ui, sans-serif",
    category: 'sans',
    weights: ['400', '500', '600', '700'],
    description: 'Urban, modern geometric',
  },
  {
    id: 'raleway',
    name: 'Raleway',
    googleFontFamily: 'Raleway:ital,wght@0,400;0,500;0,600;0,700;1,400',
    cssValue: "'Raleway', system-ui, sans-serif",
    category: 'sans',
    weights: ['400', '500', '600', '700'],
    description: 'Elegant, thin weights available',
  },
  {
    id: 'work-sans',
    name: 'Work Sans',
    googleFontFamily: 'Work+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400',
    cssValue: "'Work Sans', system-ui, sans-serif",
    category: 'sans',
    weights: ['400', '500', '600', '700'],
    description: 'Optimized for screens, great for UI',
  },
  {
    id: 'ubuntu',
    name: 'Ubuntu',
    googleFontFamily: 'Ubuntu:ital,wght@0,400;0,500;0,700;1,400',
    cssValue: "'Ubuntu', system-ui, sans-serif",
    category: 'sans',
    weights: ['400', '500', '700'],
    description: 'Ubuntu Linux system font',
  },
  {
    id: 'red-hat-display',
    name: 'Red Hat Display',
    googleFontFamily: 'Red+Hat+Display:ital,wght@0,400;0,500;0,600;0,700;1,400',
    cssValue: "'Red Hat Display', system-ui, sans-serif",
    category: 'sans',
    weights: ['400', '500', '600', '700'],
    description: 'Red Hat corporate font for headlines',
  },
  {
    id: 'red-hat-text',
    name: 'Red Hat Text',
    googleFontFamily: 'Red+Hat+Text:ital,wght@0,400;0,500;0,600;0,700;1,400',
    cssValue: "'Red Hat Text', system-ui, sans-serif",
    category: 'sans',
    weights: ['400', '500', '600', '700'],
    description: 'Red Hat corporate font for body text',
  },
  {
    id: 'manrope',
    name: 'Manrope',
    googleFontFamily: 'Manrope:wght@400;500;600;700',
    cssValue: "'Manrope', system-ui, sans-serif",
    category: 'sans',
    weights: ['400', '500', '600', '700'],
    description: 'Modern geometric with semi-condensed style',
  },
  {
    id: 'plus-jakarta-sans',
    name: 'Plus Jakarta Sans',
    googleFontFamily: 'Plus+Jakarta+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400',
    cssValue: "'Plus Jakarta Sans', system-ui, sans-serif",
    category: 'sans',
    weights: ['400', '500', '600', '700'],
    description: 'Fresh geometric, great for modern UIs',
  },
  {
    id: 'public-sans',
    name: 'Public Sans',
    googleFontFamily: 'Public+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400',
    cssValue: "'Public Sans', system-ui, sans-serif",
    category: 'sans',
    weights: ['400', '500', '600', '700'],
    description: 'US government open source font',
  },
  {
    id: 'outfit',
    name: 'Outfit',
    googleFontFamily: 'Outfit:wght@400;500;600;700',
    cssValue: "'Outfit', system-ui, sans-serif",
    category: 'sans',
    weights: ['400', '500', '600', '700'],
    description: 'Geometric, modern and friendly',
  },
  {
    id: 'albert-sans',
    name: 'Albert Sans',
    googleFontFamily: 'Albert+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400',
    cssValue: "'Albert Sans', system-ui, sans-serif",
    category: 'sans',
    weights: ['400', '500', '600', '700'],
    description: 'Geometric with rounded details',
  },
  {
    id: 'lexend',
    name: 'Lexend',
    googleFontFamily: 'Lexend:wght@400;500;600;700',
    cssValue: "'Lexend', system-ui, sans-serif",
    category: 'sans',
    weights: ['400', '500', '600', '700'],
    description: 'Designed to improve reading proficiency',
  },
  {
    id: 'noto-sans',
    name: 'Noto Sans',
    googleFontFamily: 'Noto+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400',
    cssValue: "'Noto Sans', system-ui, sans-serif",
    category: 'sans',
    weights: ['400', '500', '600', '700'],
    description: 'Google Noto family, all languages',
  },
  {
    id: 'figtree',
    name: 'Figtree',
    googleFontFamily: 'Figtree:ital,wght@0,400;0,500;0,600;0,700;1,400',
    cssValue: "'Figtree', system-ui, sans-serif",
    category: 'sans',
    weights: ['400', '500', '600', '700'],
    description: 'Friendly geometric, great for UI',
  },
  {
    id: 'geist',
    name: 'Geist Sans',
    googleFontFamily: '',
    cssValue: "'Geist', system-ui, sans-serif",
    category: 'sans',
    description: 'Vercel modern UI font (local install)',
  },
]

// Track loaded fonts
const loadedFonts = new Set<string>()
const loadingFonts = new Map<string, Promise<void>>()

/**
 * Build Google Fonts URL for a list of fonts
 */
function buildGoogleFontsUrl(fonts: FontConfig[]): string {
  const families = fonts
    .filter(f => f.googleFontFamily)
    .map(f => `family=${f.googleFontFamily}`)
    .join('&')

  if (!families) return ''

  return `https://fonts.googleapis.com/css2?${families}&display=swap`
}

/**
 * Load a single font from Google Fonts
 */
export async function loadFont(font: FontConfig): Promise<void> {
  // Skip if no Google Font family (system font)
  if (!font.googleFontFamily) {
    return
  }

  // Already loaded
  if (loadedFonts.has(font.id)) {
    return
  }

  // Already loading
  if (loadingFonts.has(font.id)) {
    return loadingFonts.get(font.id)
  }

  const loadPromise = new Promise<void>((resolve, reject) => {
    const linkId = `google-font-${font.id}`

    // Check if link already exists
    if (document.getElementById(linkId)) {
      loadedFonts.add(font.id)
      resolve()
      return
    }

    const link = document.createElement('link')
    link.id = linkId
    link.rel = 'stylesheet'
    link.href = buildGoogleFontsUrl([font])

    link.onload = () => {
      loadedFonts.add(font.id)
      loadingFonts.delete(font.id)
      resolve()
    }

    link.onerror = () => {
      loadingFonts.delete(font.id)
      console.warn(`Failed to load font: ${font.name}`)
      reject(new Error(`Failed to load font: ${font.name}`))
    }

    document.head.appendChild(link)
  })

  loadingFonts.set(font.id, loadPromise)
  return loadPromise
}

/**
 * Load multiple fonts at once
 */
export async function loadFonts(fonts: FontConfig[]): Promise<void> {
  const fontsToLoad = fonts.filter(f => f.googleFontFamily && !loadedFonts.has(f.id))

  if (fontsToLoad.length === 0) return

  await Promise.all(fontsToLoad.map(f => loadFont(f)))
}

/**
 * Preload common fonts for faster switching
 */
export async function preloadCommonFonts(): Promise<void> {
  const commonFonts = [
    MONO_FONTS.find(f => f.id === 'jetbrains-mono'),
    MONO_FONTS.find(f => f.id === 'fira-code'),
    SANS_FONTS.find(f => f.id === 'inter'),
  ].filter((f): f is FontConfig => f !== undefined)

  await loadFonts(commonFonts)
}

/**
 * Get font by ID
 */
export function getFontById(id: string): FontConfig | undefined {
  return MONO_FONTS.find(f => f.id === id) || SANS_FONTS.find(f => f.id === id)
}

/**
 * Check if a font is loaded
 */
export function isFontLoaded(fontId: string): boolean {
  return loadedFonts.has(fontId)
}

/**
 * Load font by ID and return its CSS value
 */
export async function loadFontById(fontId: string): Promise<string> {
  const font = getFontById(fontId)
  if (!font) {
    console.warn(`Font not found: ${fontId}`)
    return ''
  }

  await loadFont(font)
  return font.cssValue
}
