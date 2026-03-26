// ============================================================================
// DeltaTimelineNode — ReactFlow node for Delta Log timeline on packet canvas
// ============================================================================

import { memo, useMemo } from 'react'
import { Handle, Position } from '@xyflow/react'
import { useTheme } from '../../compat/design-system'
import type { DeltaLogEntry } from './parsePacketContent'
import { getDeltaColor } from './primitives'

export interface DeltaTimelineNodeData {
  entries: DeltaLogEntry[]
  cardScale?: number
}

function useColors() {
  const { colors } = useTheme()
  return useMemo(() => ({
    bg: colors.bgSecondary,
    bgDark: colors.bgPrimary,
    border: colors.borderPrimary,
    text: colors.textPrimary,
    textSecondary: colors.textSecondary,
    textMuted: colors.textMuted,
    accent: colors.accent,
  }), [colors])
}

const EdgeHandles = memo(({ color }: { color: string }) => (
  <>
    <Handle type="target" id="top" position={Position.Top} style={{ background: color }} />
    <Handle type="target" id="left" position={Position.Left} style={{ background: color }} />
    <Handle type="target" id="right" position={Position.Right} style={{ background: color }} />
    <Handle type="target" id="bottom" position={Position.Bottom} style={{ background: color }} />
    <Handle type="source" id="source-top" position={Position.Top} style={{ background: color }} />
    <Handle type="source" id="source-left" position={Position.Left} style={{ background: color }} />
    <Handle type="source" id="source-right" position={Position.Right} style={{ background: color }} />
    <Handle type="source" id="source-bottom" position={Position.Bottom} style={{ background: color }} />
  </>
))

function formatTimestamp(ts: string): string {
  // Show just time portion if it's a full datetime
  const timeMatch = ts.match(/(\d{2}:\d{2})(?::\d{2})?$/)
  if (timeMatch) return timeMatch[1]
  return ts
}

/** Extract readable text from delta content — may be raw JSON from engine */
function readableContent(content: string): string {
  if (!content.startsWith('{')) return content
  try {
    const parsed = JSON.parse(content)
    if (typeof parsed.content === 'string') return parsed.content
    if (typeof parsed.current === 'string') return parsed.current
    return content
  } catch {
    return content
  }
}

export const DeltaTimelineNode = memo(({ data, selected }: { data: DeltaTimelineNodeData; selected?: boolean }) => {
  const C = useColors()
  const scale = data.cardScale ?? 1.0
  const { entries } = data

  // Group by type for summary
  const typeCounts = new Map<string, number>()
  for (const e of entries) {
    typeCounts.set(e.type, (typeCounts.get(e.type) ?? 0) + 1)
  }

  return (
    <div style={{
      background: C.bg,
      border: `2px solid ${selected ? C.accent : C.border}`,
      borderLeft: `6px solid ${C.accent}`,
      borderRadius: 10,
      padding: 14,
      minWidth: 350,
      maxWidth: 450,
      cursor: 'default',
      transform: `scale(${scale})`,
      transformOrigin: 'top left',
    }}>
      <EdgeHandles color={C.accent} />

      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 10,
        paddingBottom: 8,
        borderBottom: `1px solid ${C.border}`,
      }}>
        <span style={{
          fontSize: 10,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          padding: '2px 6px',
          borderRadius: 4,
          background: `${C.accent}22`,
          color: C.accent,
        }}>
          Delta Log
        </span>
        <span style={{
          fontSize: 11,
          color: C.textMuted,
          fontFamily: 'monospace',
        }}>
          {entries.length} entries
        </span>
        <span style={{ flex: 1 }} />
        {/* Type summary badges */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {Array.from(typeCounts.entries()).map(([type, count]) => (
            <span key={type} style={{
              fontSize: 9,
              padding: '1px 5px',
              borderRadius: 3,
              background: `${getDeltaColor(type)}22`,
              color: getDeltaColor(type),
              fontWeight: 600,
            }}>
              {type} {count}
            </span>
          ))}
        </div>
      </div>

      {/* Timeline entries — visual dots with connector lines */}
      <div style={{
        background: C.bgDark,
        borderRadius: 6,
        padding: '8px 0',
        maxHeight: 500,
        overflow: 'auto',
      }}>
        {entries.map((entry, i) => {
          const color = getDeltaColor(entry.type)
          const isLast = i === entries.length - 1
          return (
            <div key={i} style={{
              padding: '4px 12px',
              display: 'flex',
              gap: 10,
              alignItems: 'stretch',
            }}>
              {/* Timeline rail: dot + connector line */}
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                width: 16,
                flexShrink: 0,
              }}>
                <div style={{
                  width: 12, height: 12, borderRadius: '50%',
                  background: color,
                  boxShadow: `0 0 8px ${color}50`,
                  flexShrink: 0,
                  marginTop: 4,
                }} />
                {!isLast && (
                  <div style={{
                    width: 2, flex: 1, minHeight: 20,
                    background: `${color}25`,
                  }} />
                )}
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0, paddingBottom: isLast ? 4 : 10 }}>
                {/* Meta: type badge + nodeId + timestamp */}
                <div style={{
                  display: 'flex', gap: 6, alignItems: 'center',
                  marginBottom: 4,
                }}>
                  <span style={{
                    fontSize: 8, fontWeight: 800, textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    padding: '2px 6px', borderRadius: 3,
                    background: `${color}20`, color,
                  }}>
                    {entry.type}
                  </span>
                  {entry.nodeId && (
                    <span style={{
                      fontSize: 9, fontFamily: 'monospace',
                      padding: '1px 5px', borderRadius: 3,
                      background: `${C.accent}12`, color: C.textSecondary,
                      fontWeight: 600,
                    }}>
                      {entry.nodeId}
                    </span>
                  )}
                  <span style={{ flex: 1 }} />
                  <span style={{
                    fontSize: 9, fontFamily: 'monospace',
                    color: C.textMuted,
                  }}>
                    {formatTimestamp(entry.timestamp)}
                  </span>
                </div>

                {/* Content */}
                <div style={{
                  fontSize: 11, color: C.textSecondary,
                  lineHeight: 1.5, wordBreak: 'break-word',
                }}>
                  {readableContent(entry.content)}
                </div>
              </div>
            </div>
          )
        })}

        {entries.length === 0 && (
          <div style={{
            padding: '12px', color: C.textMuted,
            fontSize: 11, textAlign: 'center',
          }}>
            No delta entries yet
          </div>
        )}
      </div>
    </div>
  )
})
