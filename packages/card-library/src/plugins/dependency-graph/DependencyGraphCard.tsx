import { memo, useId, useMemo, useState } from 'react'
import type { BlockRenderProps } from '../../blocks/types'
import type { DepGraphData, DepGraphNode } from './types'
import { DEP_PRIORITY_COLORS, DEP_STATUS_COLORS, DEP_STATUS_LABELS } from './types'
import { computeDepGraphLayout, getDependencyChain } from './layout'

// ---------------------------------------------------------------------------
// SVG path helpers — smooth step path, no @xyflow
// ---------------------------------------------------------------------------

/**
 * Builds a smooth-step SVG path between two points.
 * Source exits from the right side of the source node,
 * target enters from the left side of the target node.
 */
function smoothStepPath(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  radius = 10,
): string {
  const midX = (sx + tx) / 2
  const dx = tx - sx
  const dy = ty - sy

  if (Math.abs(dx) < 1) {
    // Vertical line fallback
    return `M ${sx} ${sy} L ${tx} ${ty}`
  }

  if (Math.abs(dy) < 1) {
    // Horizontal line — no bends needed
    return `M ${sx} ${sy} L ${tx} ${ty}`
  }

  const r = Math.min(radius, Math.abs(dx) / 2, Math.abs(dy) / 2)
  const signY = dy > 0 ? 1 : -1

  // Path: right from source → bend down/up → across → bend toward target → left
  // M sx,sy → midX-r,sy → curve → midX,sy+r*signY → midX,ty-r*signY → curve → midX+r,ty → tx,ty
  return [
    `M ${sx} ${sy}`,
    `L ${midX - r} ${sy}`,
    `Q ${midX} ${sy} ${midX} ${sy + r * signY}`,
    `L ${midX} ${ty - r * signY}`,
    `Q ${midX} ${ty} ${midX + r} ${ty}`,
    `L ${tx} ${ty}`,
  ].join(' ')
}

// ---------------------------------------------------------------------------
// Node card
// ---------------------------------------------------------------------------

function DepNodeCard({
  node,
  theme,
  highlighted,
  dimmed,
  onClick,
}: {
  node: DepGraphNode
  theme: BlockRenderProps<DepGraphData>['theme']
  highlighted: boolean
  dimmed: boolean
  onClick: () => void
}) {
  const { task } = node
  const statusColor = DEP_STATUS_COLORS[task.status]
  const priorityColor = task.priority ? DEP_PRIORITY_COLORS[task.priority] : undefined

  return (
    <div
      onClick={onClick}
      style={{
        position: 'absolute',
        left: node.x,
        top: node.y,
        width: node.width,
        height: node.height,
        background: theme.bgSecondary,
        border: `1px solid ${highlighted ? statusColor : theme.borderPrimary}`,
        borderLeft: `3px solid ${statusColor}`,
        borderRadius: '4px',
        padding: '6px 8px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        cursor: 'pointer',
        opacity: dimmed ? 0.35 : 1,
        transition: 'opacity 0.15s, border-color 0.15s',
        userSelect: 'none',
        overflow: 'hidden',
      }}
      data-dep-node={task.id}
    >
      {/* Header row: status badge + priority dot + id */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <span
          style={{
            fontSize: '0.75em',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            padding: '1px 4px',
            borderRadius: 3,
            background: `${statusColor}22`,
            color: statusColor,
            whiteSpace: 'nowrap',
            lineHeight: 1.4,
          }}
        >
          {DEP_STATUS_LABELS[task.status]}
        </span>
        {priorityColor && (
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: priorityColor,
              flexShrink: 0,
            }}
            title={task.priority}
          />
        )}
        <span
          style={{
            flex: 1,
            fontSize: '0.75em',
            color: theme.textMuted,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            textAlign: 'right',
          }}
          title={task.id}
        >
          #{task.id}
        </span>
      </div>
      {/* Title */}
      <div
        style={{
          fontSize: '0.75em',
          fontWeight: 600,
          color: task.status === 'done' ? theme.textMuted : theme.textPrimary,
          lineHeight: 1.3,
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          textDecoration: task.status === 'done' ? 'line-through' : 'none',
        }}
      >
        {task.title}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main card
// ---------------------------------------------------------------------------

export const DependencyGraphCard = memo(function DependencyGraphCard({
  data,
  theme,
}: BlockRenderProps<DepGraphData>) {
  const markerId = useId()
  const [highlightedId, setHighlightedId] = useState<string | null>(null)

  const layout = useMemo(() => computeDepGraphLayout(data), [data])

  const highlightedChain = useMemo((): Set<string> => {
    if (!highlightedId) return new Set()
    return getDependencyChain(highlightedId, data.tasks)
  }, [highlightedId, data.tasks])

  const handleNodeClick = (taskId: string) => {
    setHighlightedId(prev => (prev === taskId ? null : taskId))
  }

  if (data.tasks.length === 0) {
    return (
      <div
        style={{
          padding: '12px',
          background: theme.bgSecondary,
          borderRadius: theme.radius,
          color: theme.textMuted,
          fontSize: '0.75em',
          fontFamily: theme.fontSans,
        }}
      >
        No tasks defined.
      </div>
    )
  }

  const isHighlighting = highlightedId !== null

  return (
    <div
      style={{
        fontFamily: theme.fontSans,
        background: theme.bgSecondary,
        borderRadius: theme.radius,
        border: `1px solid ${theme.borderPrimary}`,
        overflow: 'hidden',
      }}
    >
      {/* Header */}
      {(data.title || layout.hasCycle) && (
        <div
          style={{
            padding: '6px 10px',
            borderBottom: `1px solid ${theme.borderPrimary}`,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {data.title && (
            <span
              style={{
                fontSize: '0.75em',
                fontWeight: 600,
                color: theme.textSecondary,
              }}
            >
              {data.title}
            </span>
          )}
          {layout.hasCycle && (
            <span
              style={{
                fontSize: '0.8em',
                padding: '1px 6px',
                borderRadius: 3,
                background: `${theme.error}22`,
                color: theme.error,
              }}
            >
              Cycle detected
            </span>
          )}
        </div>
      )}

      {/* Graph canvas */}
      <div
        style={{
          position: 'relative',
          overflow: 'auto',
          padding: 0,
        }}
        onClick={(e) => {
          // Click on canvas background clears highlight
          if ((e.target as HTMLElement).closest('[data-dep-node]') === null) {
            setHighlightedId(null)
          }
        }}
      >
        <div
          style={{
            position: 'relative',
            width: layout.totalWidth,
            height: layout.totalHeight,
            minWidth: '100%',
          }}
        >
          {/* SVG edges layer */}
          <svg
            width={layout.totalWidth}
            height={layout.totalHeight}
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              overflow: 'visible',
            }}
          >
            <defs>
              {[
                { key: 'default', color: theme.borderSecondary },
                { key: 'done', color: DEP_STATUS_COLORS.done },
                { key: 'blocked', color: DEP_STATUS_COLORS.blocked },
                { key: 'inprogress', color: DEP_STATUS_COLORS['in-progress'] },
                { key: 'highlighted', color: theme.accent },
              ].map(marker => (
                <marker
                  key={marker.key}
                  id={`${markerId}-${marker.key}`}
                  viewBox="0 0 10 10"
                  refX="9"
                  refY="5"
                  markerWidth="5"
                  markerHeight="5"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill={marker.color} />
                </marker>
              ))}
            </defs>

            {layout.edges.map((edge) => {
              const src = layout.nodeMap.get(edge.sourceId)
              const tgt = layout.nodeMap.get(edge.targetId)
              if (!src || !tgt) return null

              // Source right-center → target left-center
              const sx = src.x + src.width
              const sy = src.y + src.height / 2
              const tx = tgt.x
              const ty = tgt.y + tgt.height / 2

              const isEdgeHighlighted =
                isHighlighting &&
                highlightedChain.has(edge.sourceId) &&
                highlightedChain.has(edge.targetId)

              const isDimmed = isHighlighting && !isEdgeHighlighted

              let edgeColor: string
              let markerKey: string
              if (isEdgeHighlighted) {
                edgeColor = theme.accent
                markerKey = 'highlighted'
              } else {
                const srcStatus = src.task.status
                if (srcStatus === 'done') {
                  edgeColor = DEP_STATUS_COLORS.done
                  markerKey = 'done'
                } else if (srcStatus === 'blocked') {
                  edgeColor = DEP_STATUS_COLORS.blocked
                  markerKey = 'blocked'
                } else if (srcStatus === 'in-progress') {
                  edgeColor = DEP_STATUS_COLORS['in-progress']
                  markerKey = 'inprogress'
                } else {
                  edgeColor = theme.borderSecondary
                  markerKey = 'default'
                }
              }

              return (
                <path
                  key={`${edge.sourceId}-->${edge.targetId}`}
                  d={smoothStepPath(sx, sy, tx, ty, 12)}
                  fill="none"
                  stroke={edgeColor}
                  strokeWidth={isEdgeHighlighted ? 1.8 : 1.2}
                  opacity={isDimmed ? 0.2 : 0.85}
                  markerEnd={`url(#${markerId}-${markerKey})`}
                />
              )
            })}
          </svg>

          {/* Node cards layer */}
          {layout.nodes.map(node => {
            const highlighted = isHighlighting && highlightedChain.has(node.id)
            const dimmed = isHighlighting && !highlightedChain.has(node.id)
            return (
              <DepNodeCard
                key={node.id}
                node={node}
                theme={theme}
                highlighted={highlighted}
                dimmed={dimmed}
                onClick={() => handleNodeClick(node.id)}
              />
            )
          })}
        </div>
      </div>

      {/* Footer hint */}
      <div
        style={{
          padding: '4px 10px',
          borderTop: `1px solid ${theme.borderPrimary}`,
          fontSize: '0.75em',
          color: theme.textMuted,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <span>{data.tasks.length} task{data.tasks.length !== 1 ? 's' : ''}</span>
        <span>{highlightedId ? 'Click again to clear' : 'Click a node to highlight chain'}</span>
      </div>
    </div>
  )
})
