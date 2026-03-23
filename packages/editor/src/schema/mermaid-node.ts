import { $nodeSchema, $view } from '@milkdown/utils'
import type { MarkdownNode } from '@milkdown/transformer'
import type { Node } from '@milkdown/prose/model'
import type { Ctx } from '@milkdown/ctx'
import type { NodeViewConstructor } from '@milkdown/prose/view'
import type { ThemeTokens } from '@context-towel/card-library'

/**
 * Module-level config that editor.tsx sets before constructing the editor.
 * NodeViews read from here to pick up current theme and dark-mode state.
 */
export const mermaidViewConfig = {
  theme: undefined as ThemeTokens | undefined,
  isDark: true,
}

// ---------------------------------------------------------------------------
// Node schema
// ---------------------------------------------------------------------------

/**
 * ProseMirror node schema for mermaid diagram blocks.
 *
 * The node is `atom: true` — ProseMirror treats it as an opaque unit.
 * The NodeView handles all rendering via the lazily-loaded mermaid library.
 */
export const mermaidBlockSchema = $nodeSchema('mermaid-block', () => ({
  group: 'block',
  atom: true,
  isolating: true,
  selectable: true,
  draggable: true,
  attrs: {
    value: { default: '' },
  },
  parseDOM: [{
    tag: 'div[data-mermaid-block]',
    getAttrs: (dom) => ({
      value: (dom as HTMLElement).dataset.mermaidBlockValue ?? '',
    }),
  }],
  toDOM: (node: Node) => ['div', {
    'data-mermaid-block': '',
    'data-mermaid-block-value': node.attrs.value,
  }, 0],

  parseMarkdown: {
    match: (node: MarkdownNode) => node.type === 'mermaid-block',
    runner: (state: any, node: MarkdownNode, proseType: any) => {
      state.addNode(proseType, { value: (node as any).value ?? '' })
    },
  },

  toMarkdown: {
    match: (node: Node) => node.type.name === 'mermaid-block',
    runner: (state: any, node: Node) => {
      state.addNode('code', undefined, node.attrs.value as string, { lang: 'mermaid' })
    },
  },
}))

// ---------------------------------------------------------------------------
// Lazy mermaid loader
// ---------------------------------------------------------------------------

let _mermaid: any = null
let _mermaidLoading: Promise<any> | null = null

function getMermaid(): Promise<any> {
  if (_mermaid) return Promise.resolve(_mermaid)
  if (!_mermaidLoading) {
    _mermaidLoading = import('mermaid').then((m) => {
      _mermaid = m.default
      return _mermaid
    })
  }
  return _mermaidLoading
}

let _mermaidInitKey = ''
let _mermaidInitPromise: Promise<void> | null = null

function initMermaid(theme: ThemeTokens | undefined, isDark: boolean): Promise<void> {
  const options: any = {
    startOnLoad: false,
    theme: isDark ? 'dark' : 'default',
    securityLevel: 'loose',
    flowchart: { useMaxWidth: true, htmlLabels: false, curve: 'basis' },
    sequence: { useMaxWidth: true, wrap: true },
  }
  if (theme) {
    options.themeVariables = {
      primaryColor: theme.bgTertiary,
      primaryTextColor: theme.textPrimary,
      primaryBorderColor: theme.borderPrimary,
      lineColor: theme.borderSecondary,
      secondaryColor: theme.bgSecondary,
      tertiaryColor: theme.bgTertiary,
      background: theme.bgPrimary,
      mainBkg: theme.bgSecondary,
      nodeBorder: theme.borderPrimary,
      clusterBkg: theme.bgTertiary,
      titleColor: theme.textPrimary,
      edgeLabelBackground: theme.bgSecondary,
      nodeTextColor: theme.textPrimary,
      actorTextColor: theme.textPrimary,
      signalTextColor: theme.textPrimary,
      labelTextColor: theme.textPrimary,
    }
  }
  const key = JSON.stringify(options)
  if (_mermaidInitKey === key && _mermaidInitPromise) return _mermaidInitPromise
  _mermaidInitKey = key
  _mermaidInitPromise = getMermaid().then((m) => { m.initialize(options) })
  return _mermaidInitPromise
}

// ---------------------------------------------------------------------------
// NodeView
// ---------------------------------------------------------------------------

/**
 * Pure-DOM NodeView for mermaid-block nodes.
 *
 * Renders mermaid SVG directly — no React, since mermaid itself produces
 * SVG markup. Includes zoom controls (click buttons or Ctrl+wheel) and a
 * fullscreen hint overlay.
 */
export const mermaidBlockView = $view(mermaidBlockSchema.node, (_ctx: Ctx): NodeViewConstructor => {
  return (node) => {
    const dom = document.createElement('div')
    dom.classList.add('mermaid-block', 'clickable-fullscreen')

    // -- Zoom controls (not part of the editable content) --------------------
    const controls = document.createElement('div')
    controls.classList.add('mermaid-zoom-controls')
    controls.contentEditable = 'false'

    let zoom = 1

    const zoomOut = document.createElement('button')
    zoomOut.classList.add('mermaid-zoom-btn')
    zoomOut.textContent = '\u2212'
    zoomOut.title = 'Zoom out'

    const zoomLabel = document.createElement('span')
    zoomLabel.classList.add('mermaid-zoom-label')
    zoomLabel.textContent = '100%'

    const zoomIn = document.createElement('button')
    zoomIn.classList.add('mermaid-zoom-btn')
    zoomIn.textContent = '+'
    zoomIn.title = 'Zoom in'

    const zoomReset = document.createElement('button')
    zoomReset.classList.add('mermaid-zoom-btn')
    zoomReset.textContent = '\u21ba'
    zoomReset.title = 'Reset zoom'
    zoomReset.style.display = 'none'

    controls.appendChild(zoomOut)
    controls.appendChild(zoomLabel)
    controls.appendChild(zoomIn)
    controls.appendChild(zoomReset)
    dom.appendChild(controls)

    // -- Fullscreen hint -----------------------------------------------------
    const hint = document.createElement('div')
    hint.classList.add('fullscreen-hint')
    hint.textContent = 'Click to expand'
    dom.appendChild(hint)

    // -- SVG viewport --------------------------------------------------------
    const viewport = document.createElement('div')
    viewport.classList.add('mermaid-svg-viewport')
    const scaler = document.createElement('div')
    scaler.classList.add('mermaid-svg-scaler')
    viewport.appendChild(scaler)
    dom.appendChild(viewport)

    // -- Zoom helpers --------------------------------------------------------
    function updateZoom(newZoom: number): void {
      zoom = Math.min(4, Math.max(0.25, Math.round(newZoom * 100) / 100))
      zoomLabel.textContent = `${Math.round(zoom * 100)}%`
      // Resize the SVG width directly instead of CSS transform so the browser
      // re-renders vectors at the new size (crisp text at any zoom level).
      const svg = scaler.querySelector('svg')
      if (svg) {
        svg.style.width = `${zoom * 100}%`
      }
      zoomReset.style.display = zoom !== 1 ? '' : 'none'
    }

    zoomOut.addEventListener('click', (e) => { e.stopPropagation(); updateZoom(zoom - 0.25) })
    zoomIn.addEventListener('click', (e) => { e.stopPropagation(); updateZoom(zoom + 0.25) })
    zoomReset.addEventListener('click', (e) => { e.stopPropagation(); updateZoom(1) })
    // Prevent clicks on the controls bar from bubbling to the diagram (avoids fullscreen trigger)
    controls.addEventListener('click', (e) => e.stopPropagation())

    // Ctrl/Cmd+wheel zoom
    dom.addEventListener('wheel', (e: WheelEvent) => {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      e.stopPropagation()
      const delta = e.deltaY > 0 ? -0.1 : 0.1
      updateZoom(zoom + delta)
    }, { passive: false })

    // -- Drag-to-scroll on viewport ------------------------------------------
    let isDragging = false
    let dragStartX = 0
    let dragStartY = 0
    let scrollStartX = 0
    let scrollStartY = 0

    viewport.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return
      isDragging = true
      dragStartX = e.clientX
      dragStartY = e.clientY
      scrollStartX = viewport.scrollLeft
      scrollStartY = viewport.scrollTop
      viewport.style.cursor = 'grabbing'
      e.preventDefault()
    })

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return
      viewport.scrollLeft = scrollStartX - (e.clientX - dragStartX)
      viewport.scrollTop = scrollStartY - (e.clientY - dragStartY)
    }

    const onMouseUp = () => {
      if (!isDragging) return
      isDragging = false
      viewport.style.cursor = ''
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)

    // -- Mermaid render ------------------------------------------------------
    async function renderMermaid(code: string): Promise<void> {
      if (!code.trim()) {
        scaler.innerHTML = '<div style="color: var(--color-text-muted); padding: 10px; font-size: 12px;">Empty diagram</div>'
        controls.style.display = 'none'
        return
      }

      try {
        const { theme, isDark } = mermaidViewConfig
        await initMermaid(theme, isDark)
        const mermaidModule = await getMermaid()
        const id = `mermaid-${Date.now()}-${Math.random().toString(16).slice(2)}`
        const result = await mermaidModule.render(id, code)
        const svg = result?.svg ?? ''
        if (!svg) throw new Error('Mermaid render returned empty SVG')
        scaler.innerHTML = svg
        controls.style.display = ''
      } catch (err) {
        console.error('[mermaid-node] render failed:', err)
        const msg = err instanceof Error ? err.message : 'Failed to render diagram'
        scaler.innerHTML = [
          '<div style="color: var(--color-error); padding: 10px;">',
          '<strong>Mermaid Error:</strong> ',
          msg,
          '<pre style="margin-top: 8px; font-size: 11px; color: var(--color-text-secondary); white-space: pre-wrap;">',
          code.replace(/</g, '&lt;'),
          '</pre></div>',
        ].join('')
        controls.style.display = 'none'
      }
    }

    renderMermaid(node.attrs.value as string)

    return {
      dom,
      update(updatedNode) {
        if (updatedNode.type.name !== 'mermaid-block') return false
        renderMermaid(updatedNode.attrs.value as string)
        return true
      },
      stopEvent: () => true,
      ignoreMutation: () => true,
      selectNode() { dom.classList.add('ProseMirror-selectednode') },
      deselectNode() { dom.classList.remove('ProseMirror-selectednode') },
      destroy() {
        document.removeEventListener('mousemove', onMouseMove)
        document.removeEventListener('mouseup', onMouseUp)
      },
    }
  }
})
