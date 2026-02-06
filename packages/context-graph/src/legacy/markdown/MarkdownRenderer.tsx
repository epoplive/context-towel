import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react'
import { marked, Tokens } from 'marked'
import hljs from 'highlight.js'
import './markdown.css'
import mermaid from 'mermaid'
import renderMathInElement from 'katex/contrib/auto-render'
import 'katex/dist/katex.min.css'
import emojiDictionary from 'emoji-dictionary'
import { blockRegistry, validateBlockYaml } from '@context-towel/card-library'
import { useTheme, useMermaidTheme, Editor } from '../../compat/design-system'
import { layoutPrimitives } from '../../compat/layoutPrimitives'

interface MarkdownRendererProps {
  content: string
  onCheckboxChange?: (lineIndex: number, checked: boolean) => void
  onFullscreen?: (state: FullscreenModalState) => void
}

export interface FullscreenModalState {
  open: boolean
  type: 'mermaid' | 'code' | null
  content: string
  lang?: string
  svg?: string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const HIGHLIGHT_LANGUAGE_ALIASES: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  py: 'python',
  rs: 'rust',
  md: 'markdown',
  'c++': 'cpp',
  'c#': 'csharp',
}

function normalizeHighlightLanguage(lang?: string): string | undefined {
  if (!lang) return undefined
  const normalized = lang.trim().toLowerCase()
  const aliased = HIGHLIGHT_LANGUAGE_ALIASES[normalized] || normalized
  return aliased.replace(/[^a-z0-9-]/g, '')
}

const BLOCK_RENDER_SKIP = new Set(['task', 'checklist', 'diagram', 'log', 'toc', 'link'])

const EMOJI_SHORTCODE_REGEX = /:([a-z0-9_+-]+):/gi
const FOOTNOTE_DEF_REGEX = /^\[\^([^\]]+)\]:\s*(.*)$/
const FOOTNOTE_REF_REGEX = /\[\^([^\]]+)\]/g

type FootnoteDefinitions = Record<string, string>

const ALERT_TITLES: Record<string, string> = {
  note: 'Note',
  tip: 'Tip',
  important: 'Important',
  warning: 'Warning',
  caution: 'Caution',
}

function normalizeFootnoteId(id: string): string {
  const normalized = id.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9_-]/g, '')
  return normalized.length > 0 ? normalized : 'fn'
}

function extractFootnoteDefinitions(content: string): { content: string; definitions: FootnoteDefinitions } {
  const lines = content.split('\n')
  const output: string[] = []
  const definitions: FootnoteDefinitions = {}

  let index = 0
  while (index < lines.length) {
    const line = lines[index]
    const match = line.match(FOOTNOTE_DEF_REGEX)
    if (!match) {
      output.push(line)
      index += 1
      continue
    }

    const id = match[1]
    const defLines: string[] = [match[2] || '']
    index += 1

    while (index < lines.length) {
      const nextLine = lines[index]
      const isIndented = /^(?:\s{2,}|\t)/.test(nextLine)
      if (isIndented) {
        defLines.push(nextLine.replace(/^(?:\s{2,}|\t)/, ''))
        index += 1
        continue
      }
      if (nextLine.trim() === '') {
        const lookahead = lines[index + 1]
        if (lookahead && /^(?:\s{2,}|\t)/.test(lookahead)) {
          defLines.push('')
          index += 1
          continue
        }
      }
      break
    }

    definitions[id] = defLines.join('\n').trimEnd()
  }

  return { content: output.join('\n'), definitions }
}

function shouldSkipInlineTransform(node: Text): boolean {
  const parent = node.parentElement
  if (!parent) return false
  if (parent.closest('code, pre, script, style, textarea')) return true
  if (parent.closest('.markdown-code-block, .mermaid-block, .excalidraw-block')) return true
  return false
}

function applyFootnoteReferences(root: HTMLElement, doc: Document, definitions: FootnoteDefinitions): string[] {
  const order: string[] = []
  const indexById = new Map<string, number>()
  const refCounts = new Map<string, number>()
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []

  while (walker.nextNode()) {
    nodes.push(walker.currentNode as Text)
  }

  for (const node of nodes) {
    if (shouldSkipInlineTransform(node)) continue
    const text = node.nodeValue || ''
    if (!text.includes('[^')) continue

    let match: RegExpExecArray | null = null
    let lastIndex = 0
    const fragment = doc.createDocumentFragment()
    let replaced = false

    FOOTNOTE_REF_REGEX.lastIndex = 0
    while ((match = FOOTNOTE_REF_REGEX.exec(text))) {
      replaced = true
      const before = text.slice(lastIndex, match.index)
      if (before) fragment.appendChild(doc.createTextNode(before))

      const id = match[1]
      if (!indexById.has(id)) {
        indexById.set(id, indexById.size + 1)
        order.push(id)
      }

      const number = indexById.get(id) ?? 0
      const normalized = normalizeFootnoteId(id)
      const sup = doc.createElement('sup')
      sup.className = 'footnote-ref'
      if (!definitions[id]) {
        sup.classList.add('footnote-missing')
      }

      const link = doc.createElement('a')
      link.href = `#fn-${normalized}`
      const refCount = (refCounts.get(id) ?? 0) + 1
      refCounts.set(id, refCount)
      link.id = refCount === 1 ? `fnref-${normalized}` : `fnref-${normalized}-${refCount}`
      link.textContent = String(number)
      sup.appendChild(link)
      fragment.appendChild(sup)

      lastIndex = match.index + match[0].length
    }

    if (replaced) {
      const after = text.slice(lastIndex)
      if (after) fragment.appendChild(doc.createTextNode(after))
      node.parentNode?.replaceChild(fragment, node)
    }
  }

  return order
}

function applyEmojiShortcodes(root: HTMLElement, doc: Document): void {
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []

  while (walker.nextNode()) {
    nodes.push(walker.currentNode as Text)
  }

  for (const node of nodes) {
    if (shouldSkipInlineTransform(node)) continue
    const text = node.nodeValue || ''
    if (!text.includes(':')) continue

    let match: RegExpExecArray | null = null
    let lastIndex = 0
    const fragment = doc.createDocumentFragment()
    let replaced = false

    EMOJI_SHORTCODE_REGEX.lastIndex = 0
    while ((match = EMOJI_SHORTCODE_REGEX.exec(text))) {
      const shortcode = match[1]
      const unicode = (emojiDictionary as { getUnicode?: (name: string) => string | undefined }).getUnicode?.(shortcode)
      if (!unicode) continue

      replaced = true
      const before = text.slice(lastIndex, match.index)
      if (before) fragment.appendChild(doc.createTextNode(before))
      fragment.appendChild(doc.createTextNode(unicode))
      lastIndex = match.index + match[0].length
    }

    if (replaced) {
      const after = text.slice(lastIndex)
      if (after) fragment.appendChild(doc.createTextNode(after))
      node.parentNode?.replaceChild(fragment, node)
    }
  }
}

function appendFootnotes(root: HTMLElement, doc: Document, order: string[], definitions: FootnoteDefinitions): void {
  if (order.length === 0) return
  const section = doc.createElement('section')
  section.className = 'footnotes'
  const list = doc.createElement('ol')

  order.forEach((id) => {
    const normalized = normalizeFootnoteId(id)
    const li = doc.createElement('li')
    li.id = `fn-${normalized}`

    const definition = definitions[id]
    const definitionHtml = definition
      ? (marked.parse(definition) as string)
      : '<p class="footnote-missing">Missing footnote definition.</p>'
    li.innerHTML = definitionHtml

    const backRef = doc.createElement('a')
    backRef.href = `#fnref-${normalized}`
    backRef.className = 'footnote-backref'
    backRef.textContent = '↩︎'
    li.appendChild(backRef)

    list.appendChild(li)
  })

  section.appendChild(list)
  root.appendChild(section)
}

function transformMarkdownHtml(html: string, definitions: FootnoteDefinitions): string {
  if (typeof DOMParser === 'undefined') return html

  const parser = new DOMParser()
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html')
  const root = doc.body.firstElementChild as HTMLElement | null
  if (!root) return html

  const footnoteOrder = applyFootnoteReferences(root, doc, definitions)
  applyEmojiShortcodes(root, doc)
  appendFootnotes(root, doc, footnoteOrder, definitions)

  return root.innerHTML
}

function parseAlertBlockquote(html: string): { kind: string; title: string; bodyHtml: string } | null {
  if (typeof DOMParser === 'undefined') return null

  const parser = new DOMParser()
  const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html')
  const container = doc.body.firstElementChild as HTMLElement | null
  if (!container) return null

  const firstParagraph = container.querySelector('p')
  if (!firstParagraph) return null

  const text = firstParagraph.textContent?.trim() ?? ''
  const match = text.match(/^\[!([A-Za-z]+)\](?:\s+|$)(.*)$/)
  if (!match) return null

  const kindRaw = match[1].toLowerCase()
  const kind = ALERT_TITLES[kindRaw] ? kindRaw : 'note'
  const remainder = match[2]?.trim()

  if (remainder) {
    firstParagraph.textContent = remainder
  } else {
    firstParagraph.remove()
  }

  return {
    kind,
    title: ALERT_TITLES[kind] || match[1],
    bodyHtml: container.innerHTML,
  }
}

// Simple markdown parser for task descriptions (can't use marked recursively)
function parseSimpleMarkdown(text: string): string {
  // Detect file tree structures (lines starting with tree chars or indented paths)
  const hasTreeChars = /[├└│─]/.test(text) || /^\s*(src|\.?\w+)\//.test(text)
  if (hasTreeChars && text.split('\n').filter(l => /[├└│─]|^\s+[├└│]/.test(l)).length > 2) {
    return `<pre class="file-tree">${text.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`
  }

  // Parse tables
  const tableRegex = /^\|(.+)\|\s*\n\|[-:\s|]+\|\s*\n((?:\|.+\|\s*\n?)+)/gm
  text = text.replace(tableRegex, (_, headerRow, bodyRows) => {
    const headers = headerRow.split('|').map((h: string) => h.trim()).filter(Boolean)
    const rows = bodyRows.trim().split('\n').map((row: string) =>
      row.split('|').map((c: string) => c.trim()).filter(Boolean)
    )
    const headerHtml = '<tr>' + headers.map((h: string) => `<th>${h}</th>`).join('') + '</tr>'
    const bodyHtml = rows.map((row: string[]) =>
      '<tr>' + row.map((c: string) => `<td>${c}</td>`).join('') + '</tr>'
    ).join('')
    return `<div class="task-table-wrapper"><table><thead>${headerHtml}</thead><tbody>${bodyHtml}</tbody></table></div>`
  })

  // Parse numbered lists (must be before line break conversion)
  const lines = text.split('\n')
  let inList = false
  let listHtml = ''
  const result: string[] = []

  for (const line of lines) {
    const listMatch = line.match(/^(\d+)\.\s+(.+)$/)
    if (listMatch) {
      if (!inList) {
        inList = true
        listHtml = '<ol>'
      }
      listHtml += `<li>${listMatch[2]}</li>`
    } else {
      if (inList) {
        listHtml += '</ol>'
        result.push(listHtml)
        inList = false
        listHtml = ''
      }
      result.push(line)
    }
  }
  if (inList) {
    listHtml += '</ol>'
    result.push(listHtml)
  }
  text = result.join('\n')

  // Parse bullet lists
  text = text.replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>')
  text = text.replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')

  // Parse bold
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  // Parse italic
  text = text.replace(/\*([^*]+)\*/g, '<em>$1</em>')
  // Parse inline code
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>')
  // Parse line breaks (but not inside lists)
  text = text.replace(/\n(?!<)/g, '<br/>')

  return text
}

// Custom renderer for task lists and code blocks
const renderer = new marked.Renderer()

// Code blocks - lightweight HTML + highlight.js (fullscreen uses Monaco)
renderer.code = ({ text, lang }) => {
  const rawText = text || ''
  const escapedText = encodeURIComponent(rawText)
  const displayText = escapeHtml(rawText)
  const languageLabel = escapeHtml(lang || 'text')
  const normalizedLanguage = normalizeHighlightLanguage(lang)
  const languageClass = normalizedLanguage ? `language-${normalizedLanguage}` : 'language-plaintext'

  // Handle mermaid blocks specially
  if (lang === 'mermaid') {
    return `<div class="mermaid-block clickable-fullscreen" data-fullscreen-type="mermaid" data-mermaid="${escapedText}" data-drag-content="${escapedText}" draggable="true" data-drag-type="mermaid">
      <div class="fullscreen-hint">Click to expand</div>
      ${text}
    </div>`
  }

  // Handle excalidraw blocks
  if (lang === 'excalidraw') {
    return `<div class="excalidraw-block draggable-content" draggable="true" data-drag-type="excalidraw" data-excalidraw="${escapedText}" data-drag-content="${escapedText}">
      <div style="padding: 20px; background: var(--md-bg-secondary); border-radius: 8px; color: var(--md-text-muted); text-align: center;">
        [Excalidraw diagram - integration coming soon]
      </div>
    </div>`
  }

  // Handle task blocks - render as interactive task widget
  if (lang === 'task') {
    // Parse YAML-like task format
    const taskData: Record<string, string | string[]> = {}
    const lines = text.split('\n')
    let currentField: string | null = null
    let currentValue: string[] = []

    const saveField = () => {
      if (currentField) {
        const value = currentValue.join('\n').trim()
        taskData[currentField] = value
      }
      currentField = null
      currentValue = []
    }

    for (const line of lines) {
      const fieldMatch = line.match(/^([a-zA-Z_-]+):\s*(.*)$/)
      if (fieldMatch && !line.startsWith('  ') && !line.startsWith('\t')) {
        saveField()
        currentField = fieldMatch[1].toLowerCase()
        const value = fieldMatch[2]
        if (value && value !== '|') {
          currentValue = [value]
        }
      } else if (currentField) {
        currentValue.push(line.replace(/^  /, '').replace(/^\t/, ''))
      }
    }
    saveField()

    // Parse checklist items
    const checklistItems: { checked: boolean; text: string }[] = []
    const checklistStr = taskData.checklist as string || ''
    const checklistLines = checklistStr.split('\n')
    for (const line of checklistLines) {
      const itemMatch = line.match(/^[-*]\s*\[([ xX])\]\s*(.+)$/)
      if (itemMatch) {
        checklistItems.push({
          checked: itemMatch[1].toLowerCase() === 'x',
          text: itemMatch[2].trim()
        })
      }
    }

    // Parse tags
    const tagsStr = taskData.tags as string || ''
    const tags = tagsStr.match(/#([a-zA-Z][a-zA-Z0-9_-]*)/g) || []

    const statusColors: Record<string, string> = {
      'todo': 'var(--md-text-muted)',
      'in-progress': 'var(--md-accent)',
      'blocked': 'var(--md-error)',
      'done': 'var(--md-success)',
    }
    const priorityColors: Record<string, string> = {
      'critical': 'var(--md-error)',
      'high': 'var(--md-warning)',
      'medium': 'var(--md-accent)',
      'low': 'var(--md-text-muted)',
    }

    const title = taskData.title as string || 'Untitled Task'
    const status = (taskData.status as string || 'todo').toLowerCase()
    const priority = (taskData.priority as string || 'medium').toLowerCase()
    const owner = taskData.owner as string || ''
    const category = taskData.category as string || ''
    const activeForm = taskData['active-form'] as string || ''
    const description = taskData.description as string || ''
    const notes = taskData.notes as string || ''
    const blockedBy = taskData['blocked-by'] as string || ''

    // Calculate progress
    const checkedCount = checklistItems.filter(i => i.checked).length
    const totalCount = checklistItems.length
    const progress = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0

    // Build checklist HTML
    let checklistHtml = ''
    if (checklistItems.length > 0) {
      checklistHtml = `
        <div style="margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--md-border-primary);">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
            <span style="font-size: 10px; color: var(--md-text-muted); text-transform: uppercase;">Checklist</span>
            <div style="flex: 1; height: 4px; background: var(--md-bg-secondary); border-radius: 2px; overflow: hidden;">
              <div style="width: ${progress}%; height: 100%; background: ${progress === 100 ? 'var(--md-success)' : 'var(--md-accent)'}; transition: width 0.3s;"></div>
            </div>
            <span style="font-size: 10px; color: var(--md-text-muted);">${checkedCount}/${totalCount}</span>
          </div>
          ${checklistItems.map((item, i) => `
            <label style="display: flex; align-items: flex-start; gap: 6px; padding: 3px 0; cursor: pointer; font-size: 11px; color: ${item.checked ? 'var(--md-text-muted)' : 'var(--md-text-primary)'}; text-decoration: ${item.checked ? 'line-through' : 'none'};">
              <input type="checkbox" class="task-block-checkbox" data-task-index="${i}" ${item.checked ? 'checked' : ''} style="margin-top: 2px; cursor: pointer;" />
              <span>${item.text}</span>
            </label>
          `).join('')}
        </div>
      `
    }

    // Build tags HTML
    const tagsHtml = tags.length > 0 ? `
      <div style="display: flex; gap: 4px; flex-wrap: wrap; margin-top: 6px;">
        ${tags.map(tag => `<span style="background: var(--md-bg-secondary); color: var(--md-text-muted); padding: 1px 6px; border-radius: 3px; font-size: 9px;">${tag}</span>`).join('')}
      </div>
    ` : ''

    const escapedContent = encodeURIComponent(text)
    const ownerChip = owner
      ? `<span style="background: var(--md-bg-secondary); color: var(--md-text-muted); padding: 2px 6px; border-radius: 999px; font-size: 9px;">${owner}</span>`
      : ''
    const categoryChip = category
      ? `<span style="background: var(--md-bg-secondary); color: var(--md-text-muted); padding: 2px 6px; border-radius: 999px; font-size: 9px;">${category}</span>`
      : ''
    const activeFormChip = activeForm
      ? `<span style="background: var(--md-bg-secondary); color: var(--md-text-muted); padding: 2px 6px; border-radius: 999px; font-size: 9px;">${activeForm}</span>`
      : ''

    return `<div class="task-block-widget" data-task-content="${escapedContent}" style="background: var(--md-bg-secondary); border-radius: 8px; padding: 12px; margin: 10px 0; border-left: 4px solid ${statusColors[status] || 'var(--md-text-muted)'}; box-shadow: 0 1px 3px rgba(0,0,0,0.2);">
      <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
        <span style="font-weight: 600; font-size: 13px; color: var(--md-text-primary); flex: 1;">${title}</span>
        <span style="background: ${statusColors[status] || 'var(--md-text-muted)'}22; color: ${statusColors[status] || 'var(--md-text-muted)'}; padding: 2px 8px; border-radius: 4px; font-size: 9px; text-transform: uppercase; font-weight: 600;">${status}</span>
        <span style="background: ${priorityColors[priority] || 'var(--md-accent)'}22; color: ${priorityColors[priority] || 'var(--md-accent)'}; padding: 2px 8px; border-radius: 4px; font-size: 9px; text-transform: uppercase; font-weight: 600;">${priority}</span>
        ${ownerChip}
        ${categoryChip}
        ${activeFormChip}
      </div>
      ${description ? `<div class="task-description" style="color: var(--md-text-secondary); font-size: 11px; line-height: 1.5; margin-bottom: 6px;">${parseSimpleMarkdown(description)}</div>` : ''}
      ${blockedBy ? `<div style="color: var(--md-error); font-size: 10px; margin-top: 4px;"><strong>Blocked by:</strong> ${blockedBy}</div>` : ''}
      ${tagsHtml}
      ${checklistHtml}
      ${notes ? `<div class="task-notes" style="margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--md-border-primary); font-size: 10px; color: var(--md-text-muted);"><strong>Notes:</strong><br/>${parseSimpleMarkdown(notes)}</div>` : ''}
    </div>`
  }

  // Handle custom block types (shared block registry)
  if (lang && blockRegistry.has(lang) && !BLOCK_RENDER_SKIP.has(lang)) {
    const definition = blockRegistry.get(lang)
    const { errors } = validateBlockYaml(lang, rawText)
    const title = escapeHtml(definition?.name || lang)
    const errorHtml = errors.length > 0
      ? `<div class="block-card-errors">${errors.map((err: any) => `• ${escapeHtml(err.message)}`).join('<br/>')}</div>`
      : ''
    return `<div class="block-card">
      <div class="block-card-header">${title}</div>
      ${errorHtml}
      <pre class="block-card-body"><code class="${languageClass}">${displayText}</code></pre>
    </div>`
  }

  // Code blocks - lightweight HTML (highlighted client-side)
  return `<div class="markdown-code-block clickable-fullscreen" data-fullscreen-type="code" data-code="${escapedText}" data-lang="${escapeHtml(lang || '')}" data-drag-content="${escapedText}" data-drag-lang="${escapeHtml(lang || '')}" draggable="true" data-drag-type="code">
    <div class="code-header">
      <span class="code-lang">${languageLabel}</span>
      <span class="fullscreen-hint">Click to expand</span>
    </div>
    <pre><code class="${languageClass}">${displayText}</code></pre>
  </div>`
}

// List wrapper
renderer.list = function(token: Tokens.List): string {
  const body = token.items.map(item => this.listitem(item)).join('')
  const tag = token.ordered ? 'ol' : 'ul'
  const startAttr = token.ordered && token.start !== 1 ? ` start="${token.start}"` : ''
  return `<${tag}${startAttr}>\n${body}</${tag}>\n`
}

// Task list items with checkboxes
renderer.listitem = function(item: Tokens.ListItem): string {
  // Get text content - handle both token-based and raw text
  let content = item.text || ''
  if (this.parser && item.tokens && item.tokens.length > 0) {
    try {
      content = this.parser.parse(item.tokens)
    } catch {
      content = item.text || ''
    }
  }

  if (item.task) {
    const checkbox = `<input type="checkbox" class="task-checkbox" ${item.checked ? 'checked' : ''} />`
    return `<li class="task-list-item">${checkbox}<span>${content}</span></li>\n`
  }
  return `<li>${content}</li>\n`
}

// Links open in new tab
renderer.link = ({ href, title, text }) => {
  const titleAttr = title ? ` title="${title}"` : ''
  return `<a href="${href}"${titleAttr} target="_blank" rel="noopener noreferrer">${text}</a>`
}

// Blockquotes - make draggable
renderer.blockquote = ({ text }) => {
  const alert = parseAlertBlockquote(text)
  if (alert) {
    return `<div class="md-alert md-alert-${alert.kind}">
      <div class="md-alert-title">${alert.title}</div>
      ${alert.bodyHtml}
    </div>`
  }

  const escapedText = encodeURIComponent(text.replace(/<[^>]*>/g, ''))
  return `<blockquote class="draggable-content" draggable="true" data-drag-type="text" data-drag-content="${escapedText}" title="Drag to terminal">${text}</blockquote>`
}

// Tables - wrap in scrollable container, must use function() to access this.parser
renderer.table = function(token: Tokens.Table): string {
  try {
    const headerHtml = '<tr>' + token.header.map((cell: Tokens.TableCell) => {
      const alignAttr = cell.align ? ` style="text-align: ${cell.align}"` : ''
      const content = this.parser?.parseInline(cell.tokens) ?? cell.text
      return `<th${alignAttr}>${content}</th>`
    }).join('') + '</tr>'

    const bodyHtml = token.rows.map((row: Tokens.TableCell[]) =>
      '<tr>' + row.map((cell: Tokens.TableCell) => {
        const alignAttr = cell.align ? ` style="text-align: ${cell.align}"` : ''
        const content = this.parser?.parseInline(cell.tokens) ?? cell.text
        return `<td${alignAttr}>${content}</td>`
      }).join('') + '</tr>'
    ).join('')

    return `<div class="table-wrapper"><table><thead>${headerHtml}</thead><tbody>${bodyHtml}</tbody></table></div>`
  } catch (e) {
    console.error('table render error:', e)
    // Fallback to basic table
    const headerHtml = '<tr>' + token.header.map(cell => `<th>${cell.text}</th>`).join('') + '</tr>'
    const bodyHtml = token.rows.map(row => '<tr>' + row.map(cell => `<td>${cell.text}</td>`).join('') + '</tr>').join('')
    return `<div class="table-wrapper"><table><thead>${headerHtml}</thead><tbody>${bodyHtml}</tbody></table></div>`
  }
}

marked.use({
  renderer,
  gfm: true,
  breaks: false,
})

// Fullscreen Modal Component - exported so it can be rendered at app level
export function FullscreenModal({ state, onClose }: { state: FullscreenModalState; onClose: () => void }) {
  // Initialize mermaid with theme-aware config
  useMermaidTheme()
  const { colors } = useTheme()
  const modalRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)

  // Render mermaid in fullscreen
  useEffect(() => {
    if (!state.open || state.type !== 'mermaid' || !contentRef.current) return

    const renderMermaid = async () => {
      try {
        const { svg } = await mermaid.render(`fullscreen-mermaid-${Date.now()}`, state.content)
        if (contentRef.current) {
          contentRef.current.innerHTML = svg
        }
      } catch (err) {
        if (contentRef.current) {
          contentRef.current.innerHTML = `<div style="color: ${colors.error};">Error: ${err instanceof Error ? err.message : 'Failed to render'}</div>`
        }
      }
    }
    renderMermaid()
  }, [state.open, state.type, state.content])

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (state.open) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }
  }, [state.open, onClose])

  if (!state.open) return null

  const zoomBtnStyle: React.CSSProperties = {
    background: colors.buttonBg,
    border: `1px solid ${colors.borderPrimary}`,
    color: colors.textSecondary,
    padding: '4px 8px',
    borderRadius: '4px',
    cursor: 'pointer',
    fontSize: '12px',
  }

  return (
    <div
      ref={modalRef}
      onClick={(e) => e.target === modalRef.current && onClose()}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: colors.bgOverlay,
        zIndex: 10000,
        ...layoutPrimitives.column,
        padding: '20px',
      }}
    >
      {/* Header */}
      <div style={{ ...layoutPrimitives.row, justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <div style={{ ...layoutPrimitives.row, gap: '10px', alignItems: 'center' }}>
          <span style={{ color: colors.textMuted, fontSize: '12px', textTransform: 'uppercase' }}>
            {state.type === 'mermaid' ? 'Diagram' : state.lang || 'Code'}
          </span>
          {state.type === 'mermaid' && (
            <div style={{ ...layoutPrimitives.row, gap: '5px' }}>
              <button onClick={() => setZoom(z => Math.max(0.25, z - 0.25))} style={zoomBtnStyle}>−</button>
              <span style={{ color: colors.textSecondary, fontSize: '12px', width: '50px', textAlign: 'center' }}>{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(z => Math.min(4, z + 0.25))} style={zoomBtnStyle}>+</button>
              <button onClick={() => setZoom(1)} style={zoomBtnStyle}>Reset</button>
            </div>
          )}
        </div>
        <button onClick={onClose} style={{ ...zoomBtnStyle, fontSize: '18px', width: '32px', height: '32px' }}>×</button>
      </div>

      {/* Content */}
      <div
        style={{
          ...layoutPrimitives.fillColumn,
          overflow: state.type === 'code' ? 'hidden' : 'auto',
          background: state.type === 'code' ? colors.bgPrimary : 'transparent',
          borderRadius: '8px',
          transform: state.type === 'mermaid' ? `scale(${zoom})` : undefined,
          transformOrigin: 'top left',
          ...layoutPrimitives.column,
          alignItems: state.type === 'mermaid' ? 'center' : 'stretch',
          justifyContent: state.type === 'mermaid' ? 'center' : 'flex-start',
        }}
      >
        {state.type === 'code' ? (
          <Editor
            value={state.content}
            language={state.lang}
            readOnly
            lineNumbers
            wordWrap
            minimap={false}
            height="100%"
            style={{ ...layoutPrimitives.fill }}
          />
        ) : (
          <div ref={contentRef} style={{ width: '100%' }} />
        )}
      </div>
    </div>
  )
}

export function MarkdownRenderer({ content, onCheckboxChange, onFullscreen }: MarkdownRendererProps) {
  // Initialize mermaid with theme-aware config
  useMermaidTheme()

  const { colors } = useTheme()
  const containerRef = useRef<HTMLDivElement>(null)
  const [html, setHtml] = useState('')
  const [fullscreen, setFullscreen] = useState<FullscreenModalState>({ open: false, type: null, content: '' })

  // Open fullscreen modal - use callback if provided, otherwise local state
  const openFullscreen = useCallback((type: 'mermaid' | 'code', content: string, lang?: string, svg?: string) => {
    const state = { open: true, type, content, lang, svg }
    if (onFullscreen) {
      onFullscreen(state)
    } else {
      setFullscreen(state)
    }
  }, [onFullscreen])

  // Parse markdown
  useEffect(() => {
    try {
      const { content: cleanedContent, definitions } = extractFootnoteDefinitions(content)
      const parsed = marked.parse(cleanedContent) as string
      const transformed = transformMarkdownHtml(parsed, definitions)
      setHtml(transformed)
    } catch (e) {
      console.error('Markdown parse error:', e)
      // Fallback to escaped raw content
      setHtml(`<pre>${content.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>`)
    }
  }, [content])

  // Highlight code blocks after render
  useLayoutEffect(() => {
    if (!containerRef.current || !html) return

    const codeBlocks = containerRef.current.querySelectorAll('.markdown-code-block code')
    codeBlocks.forEach((block) => {
      if (block.classList.contains('hljs')) return
      const languageMatch = block.className.match(/language-([a-z0-9-]+)/i)
      const language = languageMatch?.[1]
      if (language && !hljs.getLanguage(language)) {
        block.classList.remove(`language-${language}`)
      }
      hljs.highlightElement(block as HTMLElement)
    })
  }, [html])

  // Render mermaid diagrams after HTML is set
  useEffect(() => {
    if (!containerRef.current || !html) return

    const mermaidBlocks = containerRef.current.querySelectorAll('.mermaid-block')
    mermaidBlocks.forEach(async (block, index) => {
      const code = decodeURIComponent(block.getAttribute('data-mermaid') || '')
      if (!code) return

      try {
        const { svg } = await mermaid.render(`mermaid-${Date.now()}-${index}`, code)
        block.innerHTML = svg
        // Re-add hint overlay
        const hintDiv = document.createElement('div')
        hintDiv.className = 'fullscreen-hint'
        hintDiv.textContent = 'Click to expand'
        block.insertBefore(hintDiv, block.firstChild)
        // Store SVG for fullscreen
        block.setAttribute('data-svg', svg)
      } catch (err) {
        console.error('Mermaid render error:', err)
        block.innerHTML = `<div style="color: var(--md-error); padding: 10px; background: var(--md-bg-secondary); border-radius: 4px;">
          <strong>Mermaid Error:</strong> ${err instanceof Error ? err.message : 'Failed to render diagram'}
          <pre style="margin-top: 8px; font-size: 11px; color: var(--md-text-secondary);">${code}</pre>
        </div>`
      }
    })
  }, [html])

  // Render math after HTML is set
  useEffect(() => {
    if (!containerRef.current || !html) return
    try {
      renderMathInElement(containerRef.current, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '\\[', right: '\\]', display: true },
          { left: '$', right: '$', display: false },
          { left: '\\(', right: '\\)', display: false },
        ],
        ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code'],
        ignoredClasses: ['mermaid-block', 'markdown-code-block', 'excalidraw-block'],
        throwOnError: false,
        strict: 'ignore',
      })
    } catch (err) {
      console.error('Math render error:', err)
    }
  }, [html])

  // Handle click for fullscreen
  useEffect(() => {
    if (!containerRef.current) return

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const fullscreenEl = target.closest('.clickable-fullscreen') as HTMLElement
      if (!fullscreenEl) return

      // Don't trigger fullscreen when selecting code text
      if (target.closest('.markdown-code-block pre')) return

      e.stopPropagation()

      const type = fullscreenEl.getAttribute('data-fullscreen-type') as 'mermaid' | 'code'
      if (type === 'mermaid') {
        const code = decodeURIComponent(fullscreenEl.getAttribute('data-mermaid') || '')
        openFullscreen('mermaid', code)
      } else if (type === 'code') {
        const code = decodeURIComponent(fullscreenEl.getAttribute('data-code') || '')
        const lang = fullscreenEl.getAttribute('data-lang') || ''
        openFullscreen('code', code, lang)
      }
    }

    containerRef.current.addEventListener('click', handleClick)
    return () => containerRef.current?.removeEventListener('click', handleClick)
  }, [html, openFullscreen])

  // Handle checkbox clicks
  useEffect(() => {
    if (!containerRef.current || !onCheckboxChange) return

    const handleCheckboxClick = (e: Event) => {
      const target = e.target as HTMLInputElement
      if (!target.classList.contains('task-checkbox')) return

      const allCheckboxes = containerRef.current?.querySelectorAll('.task-checkbox')
      if (!allCheckboxes) return

      const index = Array.from(allCheckboxes).indexOf(target)
      onCheckboxChange(index, target.checked)
    }

    containerRef.current.addEventListener('change', handleCheckboxClick)
    return () => containerRef.current?.removeEventListener('change', handleCheckboxClick)
  }, [onCheckboxChange, html])

  // Handle drag start for draggable content
  useEffect(() => {
    if (!containerRef.current) return

    const handleDragStart = (e: DragEvent) => {
      const target = (e.target as HTMLElement).closest('[draggable="true"]') as HTMLElement
      if (!target) return

      const dragType = target.getAttribute('data-drag-type') || 'text'
      const dragContent = decodeURIComponent(target.getAttribute('data-drag-content') || '')
      const dragLang = target.getAttribute('data-drag-lang') || ''

      e.dataTransfer?.setData('text/plain', dragContent)
      e.dataTransfer?.setData('application/x-looking-glass', JSON.stringify({
        type: dragType,
        content: dragContent,
        lang: dragLang,
      }))

      target.style.opacity = '0.5'
    }

    const handleDragEnd = (e: DragEvent) => {
      const target = (e.target as HTMLElement).closest('[draggable="true"]') as HTMLElement
      if (target) target.style.opacity = ''
    }

    containerRef.current.addEventListener('dragstart', handleDragStart)
    containerRef.current.addEventListener('dragend', handleDragEnd)

    return () => {
      containerRef.current?.removeEventListener('dragstart', handleDragStart)
      containerRef.current?.removeEventListener('dragend', handleDragEnd)
    }
  }, [html])

  return (
    <>
      <div
        ref={containerRef}
        className="markdown-body"
        dangerouslySetInnerHTML={{ __html: html }}
        style={{
          color: colors.textPrimary,
          fontSize: '12px',
          lineHeight: 1.4,
          // CSS variables for dynamic elements rendered in html
          ['--md-bg-secondary' as string]: colors.bgSecondary,
          ['--md-text-primary' as string]: colors.textPrimary,
          ['--md-text-secondary' as string]: colors.textSecondary,
          ['--md-text-muted' as string]: colors.textMuted,
          ['--md-border-primary' as string]: colors.borderPrimary,
          ['--md-accent' as string]: colors.accent,
          ['--md-error' as string]: colors.error,
          ['--md-success' as string]: colors.success,
          ['--md-warning' as string]: colors.warning,
        }}
      />
      {/* Only render local modal if no callback provided */}
      {!onFullscreen && (
        <FullscreenModal state={fullscreen} onClose={() => setFullscreen({ open: false, type: null, content: '' })} />
      )}
    </>
  )
}
