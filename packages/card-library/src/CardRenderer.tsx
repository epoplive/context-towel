import { useMemo, type ReactNode } from 'react'
import { blockRegistry } from './blocks/registry'
import { useCardTheme } from './theme'
import type {
  BlockInstance,
  BlockRenderProps,
  DetailLevel,
  BlockEditEvent,
} from './blocks/types'

export interface CardRendererProps {
  /** The parsed block instance to render */
  block: BlockInstance
  /** How much detail to show */
  detail?: DetailLevel
  /** Render context determines which component variant to use */
  context?: 'inline' | 'card' | 'node'
  /** Called when user edits something in the card */
  onEdit?: (event: BlockEditEvent) => void
  /** Fallback component when no renderer registered for block type */
  fallback?: React.ComponentType<{ block: BlockInstance }>
  /** Host-provided syntax highlighter for code content */
  highlighter?: (code: string, lang: string) => ReactNode
}

/**
 * Renders a block instance using the registered component for its type.
 * Looks up the block definition in the registry, selects the component
 * for the requested context, and passes theme + detail level.
 */
export function CardRenderer({
  block,
  detail = 'full',
  context = 'card',
  onEdit,
  fallback: Fallback,
  highlighter,
}: CardRendererProps) {
  const theme = useCardTheme()
  const definition = blockRegistry.get(block.type)

  const Component = useMemo(() => {
    if (!definition?.components) return null
    const components = definition.components
    // Try requested context, fall back to card, then inline
    return components[context] ?? components.card ?? components.inline ?? null
  }, [definition, context])

  if (!Component) {
    if (Fallback) return <Fallback block={block} />
    return null
  }

  if (block.data === null) return null

  const props: BlockRenderProps = {
    data: block.data,
    detail,
    theme,
    source: block.source,
    onEdit,
    highlighter,
  }

  return <Component {...props} />
}

export interface CardListRendererProps {
  /** Blocks to render */
  blocks: BlockInstance[]
  /** Detail level for all cards */
  detail?: DetailLevel
  /** Render context */
  context?: 'inline' | 'card' | 'node'
  /** Called when user edits something in any card */
  onEdit?: (event: BlockEditEvent) => void
  /** Fallback for unregistered types */
  fallback?: React.ComponentType<{ block: BlockInstance }>
  /** Optional wrapper around each card */
  wrapper?: React.ComponentType<{ block: BlockInstance; children: React.ReactNode }>
  /** Host-provided syntax highlighter */
  highlighter?: (code: string, lang: string) => ReactNode
}

/**
 * Renders a list of block instances.
 */
export function CardListRenderer({
  blocks,
  detail = 'full',
  context = 'card',
  onEdit,
  fallback,
  wrapper: Wrapper,
  highlighter,
}: CardListRendererProps) {
  return (
    <>
      {blocks.map((block, i) => {
        const key = `${block.type}-${block.source.filePath}-${block.source.range.startLine ?? i}`
        const card = (
          <CardRenderer
            key={key}
            block={block}
            detail={detail}
            context={context}
            onEdit={onEdit}
            fallback={fallback}
            highlighter={highlighter}
          />
        )
        if (Wrapper) {
          return <Wrapper key={key} block={block}>{card}</Wrapper>
        }
        return card
      })}
    </>
  )
}
