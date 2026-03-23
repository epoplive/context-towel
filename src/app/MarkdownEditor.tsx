// NOTE: @milkdown/* packages must be installed before this module resolves.
// Run: npm install @milkdown/core @milkdown/react @milkdown/crepe @milkdown/plugin-listener @milkdown/preset-commonmark
// (auth is currently broken — add these to package.json and install when fixed)

import { Milkdown, MilkdownProvider, useEditor } from '@milkdown/react'
import { Crepe } from '@milkdown/crepe'
import '@milkdown/crepe/theme/common/style.css'
import '@milkdown/crepe/theme/frame.css'

export interface MarkdownEditorProps {
  content: string
  onChange: (markdown: string) => void
  placeholder?: string
}

function MilkdownEditorInner({ content, onChange, placeholder }: MarkdownEditorProps) {
  useEditor((root: HTMLElement) => {
    let initialized = false

    const crepe = new Crepe({
      root,
      defaultValue: content,
      features: {
        [Crepe.Feature.CodeMirror]: true,
        [Crepe.Feature.ListItem]: true,
        [Crepe.Feature.BlockEdit]: true,
        [Crepe.Feature.Placeholder]: true,
        [Crepe.Feature.Cursor]: true,
      },
    })

    crepe.editor.config(() => {
      crepe.editor.onStatusChange((status: string) => {
        if (status === 'Created') {
          // Don't fire onChange on init — Milkdown re-serializes markdown and
          // mangles custom fenced blocks (~~~task, ~~~node, etc.)
          initialized = true
          return
        }
        if (initialized && status === 'Updated') {
          onChange(crepe.getMarkdown())
        }
      })
    })

    return crepe.editor
  }, [])

  return <Milkdown />
}

export function MarkdownEditor({ content, onChange, placeholder }: MarkdownEditorProps) {
  return (
    <div style={{ width: '100%', minHeight: 200 }}>
      <MilkdownProvider>
        <MilkdownEditorInner
          content={content}
          onChange={onChange}
          placeholder={placeholder}
        />
      </MilkdownProvider>
    </div>
  )
}
