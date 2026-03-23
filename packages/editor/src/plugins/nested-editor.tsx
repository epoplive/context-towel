import { useRef } from 'react'
import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react'
import { Editor as MilkdownEditor, defaultValueCtx, rootCtx, editorViewOptionsCtx } from '@milkdown/core'
import { commonmark } from '@milkdown/preset-commonmark'
import { gfm } from '@milkdown/preset-gfm'
import { history } from '@milkdown/plugin-history'
import { listener, listenerCtx } from '@milkdown/plugin-listener'
import { ensureEditorStyles } from '../editor-styles'

/**
 * Lightweight nested Milkdown editor for card description/notes fields.
 *
 * Does NOT include card-block plugins (no recursion — nested editors
 * can't contain card blocks). Supports basic markdown: headings,
 * lists, bold, italic, code, links, blockquotes.
 */
export interface NestedMarkdownFieldProps {
  value: string
  onChange: (markdown: string) => void
  placeholder?: string
  className?: string
}

function NestedEditorInner({ value, onChange, placeholder, className }: NestedMarkdownFieldProps) {
  ensureEditorStyles()

  const contentRef = useRef(value)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEditor((root) => {
    return MilkdownEditor.make()
      .config((ctx) => {
        ctx.set(rootCtx, root)
        ctx.set(defaultValueCtx, contentRef.current)
        ctx.update(editorViewOptionsCtx, (prev) => ({
          ...prev,
          editable: () => true,
        }))
        ctx.get(listenerCtx).markdownUpdated((_ctx, markdown, prevMarkdown) => {
          if (markdown !== prevMarkdown) {
            onChangeRef.current(markdown)
          }
        })
      })
      .use(commonmark)
      .use(gfm)
      .use(history)
      .use(listener)
  }, [])

  return (
    <div
      className={`context-towel-nested-editor ${className ?? ''}`}
      data-placeholder={placeholder}
    >
      <Milkdown />
    </div>
  )
}

export function NestedMarkdownField(props: NestedMarkdownFieldProps) {
  return (
    <MilkdownProvider>
      <NestedEditorInner {...props} />
    </MilkdownProvider>
  )
}
