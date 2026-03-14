// ============================================================================
// PacketPanel — Collapsible right sidebar for active packet state
// ============================================================================

import { useTheme } from '../../compat/design-system'
import { layoutPrimitives } from '../../compat/layoutPrimitives'
import { getNodeStateColor } from '../../plugins/node/types'
import type { ProblemVectorEntry, DeltaLogEntry } from './parsePacketContent'
import type { NodeSummary } from '../../hooks/usePacketPanel'

export interface PacketPanelProps {
  isOpen: boolean
  activePacketId: string | null
  packetName: string | null
  vectors: ProblemVectorEntry[]
  nodes: NodeSummary[]
  deltas: DeltaLogEntry[]
  rawContent: string | null
  isLoading: boolean
  onOpenWorkspace: () => void
  onRefresh: () => void
}

const PANEL_WIDTH = 320

// Delta type badge colors
const deltaTypeColors: Record<string, string> = {
  mutation: '#8b5cf6',
  observation: '#3b82f6',
  decision: '#f59e0b',
  hypothesis: '#22c55e',
  log: '#6b7280',
}

export function PacketPanel({
  isOpen,
  activePacketId,
  packetName,
  vectors,
  nodes,
  deltas,
  isLoading,
  onOpenWorkspace,
  onRefresh,
}: PacketPanelProps) {
  const { colors } = useTheme()

  return (
    <div
      style={{
        width: isOpen ? PANEL_WIDTH : 0,
        minWidth: isOpen ? PANEL_WIDTH : 0,
        transition: 'width 200ms ease, min-width 200ms ease',
        overflow: 'hidden',
        borderLeft: isOpen ? `1px solid ${colors.borderPrimary}` : 'none',
        background: colors.bgSecondary,
        ...layoutPrimitives.column,
        height: '100%',
      }}
    >
      {isOpen && (
        <div style={{ ...layoutPrimitives.fillColumn, overflow: 'auto' }}>
          {/* Empty state */}
          {!activePacketId && (
            <div style={{
              padding: 24,
              textAlign: 'center',
              ...layoutPrimitives.column,
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              flex: 1,
            }}>
              <div style={{ fontSize: 13, color: colors.textMuted, fontWeight: 600 }}>
                No active packet
              </div>
              <div style={{ fontSize: 11, color: colors.textMuted, lineHeight: 1.5 }}>
                Create one by right-clicking a plan file in the graph
              </div>
            </div>
          )}

          {/* Loading state */}
          {activePacketId && isLoading && (
            <div style={{ padding: 24, textAlign: 'center', color: colors.textMuted, fontSize: 12 }}>
              Loading packet...
            </div>
          )}

          {/* Active packet content */}
          {activePacketId && !isLoading && (
            <>
              {/* Header */}
              <div style={{
                padding: '12px 16px',
                borderBottom: `1px solid ${colors.borderPrimary}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: colors.textPrimary,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}>
                    {packetName ?? activePacketId}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 4, alignItems: 'center' }}>
                    <span style={{
                      fontSize: 10,
                      padding: '1px 6px',
                      borderRadius: 3,
                      background: '#3b82f622',
                      color: '#3b82f6',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                    }}>
                      active
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button
                    onClick={onRefresh}
                    style={{
                      background: colors.buttonBg,
                      border: `1px solid ${colors.borderSecondary}`,
                      color: colors.textSecondary,
                      padding: '3px 8px',
                      borderRadius: 4,
                      cursor: 'pointer',
                      fontSize: 10,
                    }}
                    title="Refresh packet data"
                  >
                    Refresh
                  </button>
                </div>
              </div>

              {/* Problem Vectors */}
              {vectors.length > 0 && (
                <div style={{
                  borderBottom: `1px solid ${colors.borderPrimary}`,
                  padding: '10px 16px',
                }}>
                  <div style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: colors.textMuted,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: 8,
                  }}>
                    Vectors ({vectors.length})
                  </div>
                  {vectors.map(v => (
                    <div key={v.id} style={{
                      padding: '6px 0',
                      borderBottom: `1px solid ${colors.borderSecondary}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{
                          fontFamily: 'monospace',
                          fontSize: 11,
                          fontWeight: 600,
                          color: colors.textPrimary,
                        }}>
                          {v.id}
                        </span>
                        <span style={{
                          fontSize: 9,
                          padding: '1px 4px',
                          borderRadius: 2,
                          background: v.state === 'resolved' ? '#22c55e22' : '#3b82f622',
                          color: v.state === 'resolved' ? '#22c55e' : '#3b82f6',
                          fontWeight: 600,
                          textTransform: 'uppercase',
                        }}>
                          {v.state}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: colors.textSecondary, marginTop: 3 }}>
                        {v.current}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* AICCL Nodes */}
              {nodes.length > 0 && (
                <div style={{
                  borderBottom: `1px solid ${colors.borderPrimary}`,
                  padding: '10px 16px',
                }}>
                  <div style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: colors.textMuted,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: 8,
                  }}>
                    Nodes ({nodes.length})
                  </div>
                  {nodes.map(n => (
                    <div key={n.nodeId} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      padding: '5px 0',
                      borderBottom: `1px solid ${colors.borderSecondary}`,
                    }}>
                      <div style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: getNodeStateColor(n.state as 'active' | 'success' | 'failed'),
                        flexShrink: 0,
                      }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontFamily: 'monospace',
                          fontSize: 11,
                          fontWeight: 600,
                          color: colors.textPrimary,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {n.nodeId}
                        </div>
                        {n.layer && (
                          <div style={{ fontSize: 10, color: colors.textMuted }}>
                            {n.layer}{n.subsystem ? ` / ${n.subsystem}` : ''}
                          </div>
                        )}
                      </div>
                      <span style={{
                        fontSize: 9,
                        color: getNodeStateColor(n.state as 'active' | 'success' | 'failed'),
                        fontWeight: 600,
                        textTransform: 'uppercase',
                      }}>
                        {n.state}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {/* Recent Deltas */}
              {deltas.length > 0 && (
                <div style={{
                  borderBottom: `1px solid ${colors.borderPrimary}`,
                  padding: '10px 16px',
                }}>
                  <div style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: colors.textMuted,
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px',
                    marginBottom: 8,
                  }}>
                    Recent Deltas ({deltas.length})
                  </div>
                  {deltas.slice(-5).reverse().map((d, i) => (
                    <div key={i} style={{
                      padding: '5px 0',
                      borderBottom: `1px solid ${colors.borderSecondary}`,
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <span style={{
                          fontSize: 9,
                          padding: '1px 4px',
                          borderRadius: 2,
                          background: `${deltaTypeColors[d.type] ?? deltaTypeColors.log}22`,
                          color: deltaTypeColors[d.type] ?? deltaTypeColors.log,
                          fontWeight: 600,
                        }}>
                          {d.type}
                        </span>
                        <span style={{
                          fontSize: 10,
                          color: colors.textMuted,
                          fontFamily: 'monospace',
                        }}>
                          {d.timestamp}
                        </span>
                      </div>
                      <div style={{
                        fontSize: 11,
                        color: colors.textSecondary,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {d.content}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Open Full Workspace */}
              <div style={{ padding: '12px 16px' }}>
                <button
                  onClick={onOpenWorkspace}
                  style={{
                    width: '100%',
                    background: colors.accent,
                    color: colors.textInverse,
                    border: 'none',
                    padding: '8px 12px',
                    borderRadius: 4,
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 600,
                  }}
                >
                  Open Full Workspace
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
