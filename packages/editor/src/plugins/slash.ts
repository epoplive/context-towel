import { slashFactory } from '@milkdown/plugin-slash'
import type { Ctx } from '@milkdown/ctx'
import type { EditorView } from '@milkdown/prose/view'
import type { EditorState } from '@milkdown/prose/state'
import { blockRegistry } from '@context-towel/card-library'

/**
 * Slash command plugin for inserting block types.
 *
 * Type "/" at the start of a line or after whitespace → dropdown with
 * registered block types. Selecting one inserts a fenced code block skeleton.
 *
 * We manage the floating menu ourselves (no SlashProvider) to avoid the
 * 200ms debounce and show/hide timing issues.
 */

function getBlockSkeletons(): Array<{ type: string; name: string; skeleton: string }> {
  const items: Array<{ type: string; name: string; skeleton: string }> = []
  for (const def of blockRegistry.list()) {
    const skeleton = def.skeleton
      ? def.skeleton()
      : `title: New ${def.name}`
    items.push({ type: def.type, name: def.name, skeleton })
  }
  return items.sort((a, b) => a.name.localeCompare(b.name))
}

/** Extract slash command state from the current cursor position. */
function getSlashState(view: EditorView): { active: false } | { active: true; filter: string; slashPos: number } {
  const { selection } = view.state
  if (!selection.empty) return { active: false }

  const $pos = selection.$from
  // Get text within the current text block, up to cursor
  const textInBlock = $pos.parent.textBetween(0, $pos.parentOffset, '\0', '\ufffc')
  // Match / preceded by start-of-block or whitespace
  const match = textInBlock.match(/(^|[\s])\/([^\s]*)$/)
  if (!match) return { active: false }

  const filter = match[2]
  // Compute the document-level position of the slash character
  const offsetInBlock = textInBlock.length - match[0].length + (match[1].length)
  const slashPos = $pos.start() + offsetInBlock

  return { active: true, filter, slashPos }
}

function insertBlock(view: EditorView, type: string, skeleton: string, slashPos: number) {
  const { state, dispatch } = view
  const { from } = state.selection

  const fence = '```'
  const blockText = `${fence}${type}\n${skeleton}\n${fence}\n`
  const tr = state.tr.replaceWith(
    slashPos,
    from,
    state.schema.text(blockText),
  )
  dispatch(tr)
  view.focus()
}

export const slash = slashFactory('slashMenu')

/**
 * Configure the slash plugin spec with the menu view.
 * Call this inside the editor's .config() step BEFORE .use(slash).
 */
export function configureSlash(ctx: Ctx) {
  ctx.set(slash.key, {
    view: (view: EditorView) => {
      // Build the menu DOM
      const menu = document.createElement('div')
      menu.classList.add('context-towel-slash-menu')
      menu.style.cssText = 'display:none;position:fixed;z-index:9999;'
      document.body.appendChild(menu)

      let visible = false
      let selectedIndex = 0
      let currentItems: Array<{ type: string; name: string; skeleton: string }> = []
      let currentSlashPos = 0

      function show(items: typeof currentItems, slashPos: number, coords: { left: number; bottom: number }) {
        currentItems = items
        currentSlashPos = slashPos
        selectedIndex = 0
        visible = true

        menu.innerHTML = ''
        if (items.length === 0) {
          const empty = document.createElement('div')
          empty.classList.add('slash-menu-empty')
          empty.textContent = 'No matching blocks'
          menu.appendChild(empty)
        } else {
          items.forEach((item, idx) => {
            const row = document.createElement('div')
            row.classList.add('slash-menu-item')
            if (idx === 0) row.classList.add('slash-menu-item--active')
            row.textContent = item.name
            row.addEventListener('mousedown', (e) => {
              e.preventDefault()
              insertBlock(view, item.type, item.skeleton, currentSlashPos)
              hide()
            })
            row.addEventListener('mouseenter', () => {
              selectedIndex = idx
              updateActiveItem()
            })
            menu.appendChild(row)
          })
        }

        menu.style.display = ''
        menu.style.left = `${coords.left}px`
        menu.style.top = `${coords.bottom + 4}px`
      }

      function hide() {
        if (!visible) return
        visible = false
        menu.style.display = 'none'
      }

      function updateActiveItem() {
        const rows = menu.querySelectorAll('.slash-menu-item')
        rows.forEach((el, i) => {
          el.classList.toggle('slash-menu-item--active', i === selectedIndex)
        })
      }

      function syncMenu(v: EditorView) {
        const state = getSlashState(v)
        if (!state.active) {
          hide()
          return
        }

        const allItems = getBlockSkeletons()
        const filtered = state.filter
          ? allItems.filter(i =>
              i.name.toLowerCase().includes(state.filter.toLowerCase()) ||
              i.type.includes(state.filter.toLowerCase()))
          : allItems

        // Get cursor coordinates for positioning
        const coords = v.coordsAtPos(v.state.selection.from)
        show(filtered, state.slashPos, coords)
      }

      // Keyboard navigation — use capture phase so we intercept before ProseMirror
      const handleKeydown = (e: KeyboardEvent) => {
        if (!visible) return

        if (e.key === 'ArrowDown') {
          e.preventDefault()
          e.stopPropagation()
          selectedIndex = Math.min(selectedIndex + 1, currentItems.length - 1)
          updateActiveItem()
        } else if (e.key === 'ArrowUp') {
          e.preventDefault()
          e.stopPropagation()
          selectedIndex = Math.max(selectedIndex - 1, 0)
          updateActiveItem()
        } else if (e.key === 'Enter') {
          e.preventDefault()
          e.stopPropagation()
          const item = currentItems[selectedIndex]
          if (item) {
            insertBlock(view, item.type, item.skeleton, currentSlashPos)
            hide()
          }
        } else if (e.key === 'Escape') {
          e.preventDefault()
          e.stopPropagation()
          hide()
        }
        // All other keys (backspace, letters, etc.) fall through to ProseMirror
      }
      view.dom.addEventListener('keydown', handleKeydown, true)

      // Initial sync
      syncMenu(view)

      return {
        update: (updatedView: EditorView, _prevState?: EditorState) => {
          syncMenu(updatedView)
        },
        destroy: () => {
          view.dom.removeEventListener('keydown', handleKeydown, true)
          menu.remove()
        },
      }
    },
  })
}
