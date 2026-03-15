/**
 * Runtime CSS injection for MarkdownRenderer.
 *
 * In Vite dev mode: the CSS is imported directly (Vite handles it).
 * In built dist: the post-build script inlines the CSS as a string,
 * and we inject it as a <style> tag on first render.
 */

// Direct CSS import — works in Vite dev mode.
// In tsup build, this gets extracted to index.css and replaced by the post-build script.
import './markdown.css'

// This variable is null in source / Vite dev (the CSS import above handles it).
// The post-build script replaces this with the actual CSS string for dist consumers.
let cssText: string | null = null

const STYLE_ID = 'context-towel-markdown-styles'
let injected = false

export function ensureStylesInjected(): void {
  if (injected) return
  if (typeof document === 'undefined') return

  // Check if already injected (by us or by Vite's CSS handling)
  if (document.getElementById(STYLE_ID)) {
    injected = true
    return
  }

  // In dist builds, cssText is populated by the post-build script.
  // Inject it as a <style> tag.
  if (cssText) {
    const style = document.createElement('style')
    style.id = STYLE_ID
    style.textContent = cssText
    document.head.appendChild(style)
  }

  injected = true
}
