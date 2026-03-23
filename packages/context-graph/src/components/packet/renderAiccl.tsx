// ============================================================================
// AICCL Syntax-Aware Rendering
//
// Renders AICCL body text with semantic highlighting:
// - Logic symbols (∀ ∃ → ∧ ∨) get subtle color tinting
// - State markers (✓ 💀 ! ⊥) get semantic highlighting
// - files: references become styled links
// - Comp map symbols get colored chip backgrounds (when maps provided)
// ============================================================================

import { createElement, type ReactElement } from 'react'

// ── Logic symbol patterns ───────────────────────────────────────

const LOGIC_SYMBOLS = new Set([
  '∀', '∃', '→', '↔', '¬', '∧', '∨', '⊕',
  '≡', '≠', '≈', '∩', '∪', '∅', '⊂',
  'Σ', 'Π', 'δ', '∂', '⊤', '⊥', '⟹', '⟶', '⟳', '∞',
  '↑', '↓', '∈',
])

const STATE_MARKERS: Record<string, { color: string; label: string }> = {
  '✓': { color: '#22c55e', label: 'proven' },
  '\u{1F480}': { color: '#ef4444', label: 'dead path' },    // skull emoji
  '!': { color: '#f59e0b', label: 'invariant' },
  '⊥': { color: '#ef4444', label: 'failure' },
  '[ok]': { color: '#22c55e', label: 'proven' },
  '[dead]': { color: '#6b7280', label: 'dead path' },
  '[fail]': { color: '#ef4444', label: 'failure' },
}

interface RenderOptions {
  /** Resolved symbol table: symbol → expansion */
  symbolTable?: Map<string, string>
  /** Callback when a file reference is clicked */
  onFileClick?: (file: string, line?: number) => void
  /** Logic symbol color */
  logicColor?: string
}

/**
 * Render AICCL body text as an array of React elements with syntax highlighting.
 */
export function renderAiccl(
  body: string,
  options: RenderOptions = {},
): ReactElement[] {
  const {
    symbolTable,
    onFileClick,
    logicColor = '#a78bfa',
  } = options

  const lines = body.split('\n')
  const elements: ReactElement[] = []

  for (let li = 0; li < lines.length; li++) {
    const line = lines[li]

    // files: reference line
    if (line.trimStart().startsWith('files:')) {
      elements.push(renderFilesLine(line, li, onFileClick))
      continue
    }

    // State marker line (starts with ✓, 💀, !, [ok], [dead], [fail])
    const stateMatch = checkStateMarker(line.trimStart())
    if (stateMatch) {
      elements.push(renderStateMarkerLine(line, li, stateMatch))
      continue
    }

    // Regular line — apply inline highlighting
    elements.push(renderInlineLine(line, li, logicColor, symbolTable))
  }

  return elements
}

// ── Line renderers ──────────────────────────────────────────────

function renderFilesLine(
  line: string,
  key: number,
  onFileClick?: (file: string, line?: number) => void,
): ReactElement {
  const prefix = line.slice(0, line.indexOf('files:') + 6)
  const refs = line.slice(line.indexOf('files:') + 6).trim()
  const files = refs.split(',').map(f => f.trim()).filter(Boolean)

  const children: ReactElement[] = [
    createElement('span', { key: 'prefix', style: { color: '#6b7280' } }, prefix + ' '),
  ]

  for (let i = 0; i < files.length; i++) {
    const fileRef = files[i]
    const [filePath, lineNum] = fileRef.split(':')
    if (i > 0) {
      children.push(createElement('span', { key: `sep-${i}`, style: { color: '#6b7280' } }, ', '))
    }
    children.push(createElement('span', {
      key: `file-${i}`,
      style: {
        color: '#3b82f6',
        textDecoration: 'underline',
        cursor: onFileClick ? 'pointer' : 'default',
      },
      onClick: onFileClick ? () => onFileClick(filePath, lineNum ? parseInt(lineNum, 10) : undefined) : undefined,
    }, fileRef))
  }

  return createElement('div', { key }, ...children)
}

function renderStateMarkerLine(
  line: string,
  key: number,
  marker: { color: string; label: string },
): ReactElement {
  return createElement('div', {
    key,
    style: { color: marker.color },
    title: marker.label,
  }, line)
}

function renderInlineLine(
  line: string,
  key: number,
  logicColor: string,
  symbolTable?: Map<string, string>,
): ReactElement {
  // Fast path: no special chars
  if (!hasSpecialChars(line) && !symbolTable?.size) {
    return createElement('div', { key }, line)
  }

  const segments: ReactElement[] = []
  let cursor = 0
  const chars = [...line] // handle multi-byte unicode

  for (let i = 0; i < chars.length; i++) {
    const char = chars[i]

    // Logic symbol
    if (LOGIC_SYMBOLS.has(char)) {
      if (i > cursor) {
        segments.push(createElement('span', { key: `t-${cursor}` }, chars.slice(cursor, i).join('')))
      }
      segments.push(createElement('span', {
        key: `l-${i}`,
        style: { color: logicColor, fontWeight: 600 },
      }, char))
      cursor = i + 1
      continue
    }

    // Comp map symbol (if table provided)
    if (symbolTable && symbolTable.has(char)) {
      if (i > cursor) {
        segments.push(createElement('span', { key: `t-${cursor}` }, chars.slice(cursor, i).join('')))
      }
      segments.push(createElement('span', {
        key: `s-${i}`,
        style: {
          background: '#a78bfa22',
          padding: '0 3px',
          borderRadius: 3,
          cursor: 'help',
        },
        title: symbolTable.get(char),
      }, char))
      cursor = i + 1
    }
  }

  // Remaining text
  if (cursor < chars.length) {
    segments.push(createElement('span', { key: `t-${cursor}` }, chars.slice(cursor).join('')))
  }

  return createElement('div', { key }, ...segments)
}

// ── Helpers ─────────────────────────────────────────────────────

function checkStateMarker(trimmed: string): { color: string; label: string } | null {
  for (const [marker, info] of Object.entries(STATE_MARKERS)) {
    if (trimmed.startsWith(marker)) return info
  }
  return null
}

function hasSpecialChars(text: string): boolean {
  for (const char of text) {
    if (LOGIC_SYMBOLS.has(char)) return true
  }
  return false
}
