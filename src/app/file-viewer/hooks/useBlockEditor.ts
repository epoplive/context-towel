import { useCallback, useRef, type RefObject } from 'react'
import {
  updateBlockInMarkdown,
  parseMarkdownBlocks,
  type BlockEditEvent,
} from '@context-towel/card-library'
import { writeFileContent } from '../../tauriFileService'
import type { EditorHandle } from '@context-towel/editor'

/**
 * Handles block edit events (checkbox toggle, etc.) by patching
 * the markdown source and writing back to file.
 */
export function useBlockEditor(
  filePath: string,
  contentRef: RefObject<string | null>,
  setContent: (content: string) => void,
  editorRef: RefObject<EditorHandle | null>,
) {
  const editSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleEditBlock = useCallback(async (event: BlockEditEvent) => {
    const currentContent = contentRef.current
    if (!currentContent) return

    const { blocks } = parseMarkdownBlocks(currentContent, filePath)
    const sameType = blocks.filter(b => b.type === event.blockType)

    let matchingBlock = event.blockId
      ? sameType.find(b => b.data && typeof b.data === 'object' && 'id' in b.data && (b.data as { id: string }).id === event.blockId)
      : undefined

    if (!matchingBlock && event.blockIndex != null && event.blockIndex < sameType.length) {
      matchingBlock = sameType[event.blockIndex]
    }

    if (!matchingBlock) matchingBlock = sameType[0]
    if (!matchingBlock) return

    const path = event.field.split('.').map(segment => {
      const num = Number(segment)
      return Number.isNaN(num) ? segment : num
    })

    const { content: patched, errors } = updateBlockInMarkdown(
      currentContent,
      matchingBlock,
      [{ path, value: event.value }]
    )

    if (errors.length > 0) {
      console.error('[FileViewer] Block update errors:', errors)
      return
    }

    setContent(patched)
    editorRef.current?.replaceContent(patched)
    await writeFileContent(filePath, patched)
  }, [filePath, contentRef, setContent, editorRef])

  const handleEditorChange = useCallback((markdown: string) => {
    setContent(markdown)
    if (editSaveTimerRef.current !== null) {
      clearTimeout(editSaveTimerRef.current)
    }
    editSaveTimerRef.current = setTimeout(async () => {
      editSaveTimerRef.current = null
      await writeFileContent(filePath, markdown)
    }, 500)
  }, [filePath, setContent])

  /** Cancel pending saves (call when leaving edit mode) */
  const cancelPendingSave = useCallback(() => {
    if (editSaveTimerRef.current !== null) {
      clearTimeout(editSaveTimerRef.current)
      editSaveTimerRef.current = null
    }
  }, [])

  return { handleEditBlock, handleEditorChange, cancelPendingSave }
}
