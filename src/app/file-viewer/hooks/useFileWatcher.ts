import { useEffect, useState, useRef, type RefObject } from 'react'
import { readFileContent, watchFile } from '../../tauriFileService'
import type { EditorHandle } from '@context-towel/editor'

/**
 * Watch a file for changes and keep content in sync.
 * Returns current content and a setter for local updates.
 * Watches the specific file (not the directory) to avoid crashing
 * when the file is inside a large monorepo.
 */
export function useFileWatcher(
  filePath: string,
  editorRef: RefObject<EditorHandle | null>,
  isEditingRef: RefObject<boolean>,
) {
  const [content, setContent] = useState<string | null>(null)
  const contentRef = useRef<string | null>(null)

  // Keep contentRef in sync
  useEffect(() => { contentRef.current = content }, [content])

  // Load file content
  useEffect(() => {
    let cancelled = false
    readFileContent(filePath).then(text => {
      if (!cancelled && text !== null) setContent(text)
    })
    return () => { cancelled = true }
  }, [filePath])

  // Watch for file changes
  useEffect(() => {
    let unsub: (() => void) | null = null

    watchFile(filePath, async () => {
      if (isEditingRef.current) return
      const text = await readFileContent(filePath)
      if (text !== null) {
        setContent(text)
        editorRef.current?.replaceContent(text)
      }
    }).then(fn => { unsub = fn })

    return () => { unsub?.() }
  }, [filePath, editorRef, isEditingRef])

  return { content, setContent, contentRef }
}
