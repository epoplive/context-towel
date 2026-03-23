import { memo, useMemo } from 'react'
import { Handle, Position } from '@xyflow/react'
import { useTheme } from '../../compat/design-system'
import type { IndexEntityItem } from './types'

/** Color for each entity type */
const ENTITY_COLORS: Record<string, string> = {
  file: '#60a5fa',
  system: '#a78bfa',
  interface: '#34d399',
  problem: '#f87171',
  pipeline: '#fbbf24',
  snippet: '#38bdf8',
  doc: '#818cf8',
  link: '#fb923c',
}

/** Entity type label */
const TYPE_LABELS: Record<string, string> = {
  file: 'FILE',
  system: 'SYS',
  interface: 'INTF',
  problem: 'PROB',
  pipeline: 'FLOW',
  snippet: 'CODE',
  doc: 'DOC',
  link: 'LINK',
}

export interface IndexEntityNodeData {
  item: IndexEntityItem
  cardScale?: number
}

const EdgeHandles = memo(({ color }: { color: string }) => (
  <>
    <Handle type="target" id="top" position={Position.Top} style={{ background: color }} />
    <Handle type="target" id="left" position={Position.Left} style={{ background: color }} />
    <Handle type="source" id="source-right" position={Position.Right} style={{ background: color }} />
    <Handle type="source" id="source-bottom" position={Position.Bottom} style={{ background: color }} />
  </>
))

/**
 * Graph node for an index entity.
 * Compact card showing entity type badge, ID, name, and ref count.
 */
export const IndexEntityNode = memo(function IndexEntityNode({
  data,
  selected,
}: {
  data: IndexEntityNodeData
  selected?: boolean
}) {
  const { colors } = useTheme()
  const { item, cardScale = 1.0 } = data
  const color = ENTITY_COLORS[item.entityType] || '#888'
  const typeLabel = TYPE_LABELS[item.entityType] || item.entityType.toUpperCase()

  const style = useMemo(() => ({
    container: {
      minWidth: 160 * cardScale,
      maxWidth: 280 * cardScale,
      background: colors.bgSecondary,
      border: `1px solid ${selected ? color : colors.borderPrimary}`,
      borderRadius: 6 * cardScale,
      padding: `${4 * cardScale}px ${8 * cardScale}px`,
      fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
      boxShadow: selected ? `0 0 0 2px ${color}44` : undefined,
      cursor: 'grab',
    } as const,
    header: {
      display: 'flex' as const,
      alignItems: 'center' as const,
      gap: 4 * cardScale,
      marginBottom: 2 * cardScale,
    },
    typeBadge: {
      fontSize: 9 * cardScale,
      fontWeight: 700 as const,
      textTransform: 'uppercase' as const,
      letterSpacing: 0.5,
      padding: `0px ${4 * cardScale}px`,
      borderRadius: 3,
      background: `${color}22`,
      color,
      whiteSpace: 'nowrap' as const,
    },
    entityId: {
      fontFamily: "'SF Mono', 'Fira Code', monospace",
      fontSize: 11 * cardScale,
      fontWeight: 700 as const,
      color,
    },
    name: {
      fontSize: 11 * cardScale,
      fontWeight: 500 as const,
      color: colors.textPrimary,
      overflow: 'hidden' as const,
      textOverflow: 'ellipsis' as const,
      whiteSpace: 'nowrap' as const,
      flex: 1,
    },
    meta: {
      fontSize: 9 * cardScale,
      color: colors.textMuted,
      display: 'flex' as const,
      gap: 6 * cardScale,
    },
  }), [colors, color, cardScale, selected])

  return (
    <div style={style.container}>
      <EdgeHandles color={color} />

      {/* Header: type badge + ID */}
      <div style={style.header}>
        <span style={style.typeBadge}>{typeLabel}</span>
        <span style={style.entityId}>{item.entityId}</span>
        <span style={style.name}>{item.name}</span>
      </div>

      {/* Description */}
      {item.description && (
        <div style={{
          fontSize: 10 * cardScale,
          color: colors.textSecondary,
          marginBottom: 2 * cardScale,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {item.description}
        </div>
      )}

      {/* Meta row */}
      <div style={style.meta}>
        {item.refCount > 0 && (
          <span>{item.refCount} ref{item.refCount !== 1 ? 's' : ''}</span>
        )}
        {item.linkedIds && item.linkedIds.length > 0 && (
          <span>{item.linkedIds.length} linked</span>
        )}
        {item.steps && item.steps.length > 0 && (
          <span>{item.steps.length} steps</span>
        )}
      </div>
    </div>
  )
})
