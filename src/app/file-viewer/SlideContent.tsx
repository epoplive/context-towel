import { useMemo } from 'react'
import { MarkdownEditor } from '@context-towel/editor'
import { type BlockEditEvent, type ThemeTokens, type TaskData } from '@context-towel/card-library'
import { TaskBoardView } from '@context-towel/context-graph/graph'
import { splitSlideContent, toTaskItems, buildBlockRenderCard } from './utils'

interface SlideContentProps {
  content: string
  filePath: string
  isPlan: boolean
  theme: ThemeTokens
  isDark: boolean
  onEditBlock?: (event: BlockEditEvent) => void
}

export function SlideContent({ content, filePath, isPlan, theme, isDark, onEditBlock }: SlideContentProps) {
  const segments = useMemo(
    () => isPlan ? splitSlideContent(content, filePath) : [{ type: 'markdown' as const, content }],
    [content, filePath, isPlan]
  )

  return (
    <>
      {segments.map((seg, i) => {
        if (seg.type === 'markdown') {
          return (
            <MarkdownEditor
              key={i}
              content={seg.content}
              editable={false}
              onCardEdit={onEditBlock}
              theme={theme}
              isDark={isDark}
            />
          )
        }

        const segTaskItems = toTaskItems(
          seg.blocks.map(b => b.data as TaskData).filter(Boolean),
          seg.filePath
        )
        return (
          <div key={i} style={{ margin: '1em 0' }}>
            <TaskBoardView
              tasks={segTaskItems}
              parentDocId={seg.filePath}
              taskListId={`slide-board-${i}`}
              renderCard={buildBlockRenderCard(seg.blocks, theme, onEditBlock)}
            />
          </div>
        )
      })}
    </>
  )
}
