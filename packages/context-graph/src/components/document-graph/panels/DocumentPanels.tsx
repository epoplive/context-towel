import type { CodeViewerComponent, FullscreenModalState } from '@context-towel/markdown'

import type { ProjectSettings } from '../../../compat/project-settings'
import { useTheme, Icon, icons } from '../../../compat/design-system'
import { layoutPrimitives } from '../../../compat/layoutPrimitives'
import { getDocType } from '../../../state/layoutUtils'
import type { ParsedDocContent } from '../../../state/slices/types'
import type { TreeItem } from '../../../types'
import { SectionView } from '../SectionView'
import { getNodeStateColor } from '../../../plugins/node/types'
import type { ProblemVectorEntry, DeltaLogEntry } from '../../packet/parsePacketContent'
import type { NodeSummary } from '../../../hooks/usePacketPanel'

// Delta type badge colors
const deltaTypeColors: Record<string, string> = {
  mutation: '#8b5cf6',
  observation: '#3b82f6',
  decision: '#f59e0b',
  hypothesis: '#22c55e',
  log: '#6b7280',
}

export interface PacketAccordionData {
  activePacketId: string | null
  packetName: string | null
  vectors: ProblemVectorEntry[]
  nodes: NodeSummary[]
  deltas: DeltaLogEntry[]
  isLoading: boolean
  onRefresh: () => void
  onClose: () => void
}

interface PanelEntry {
  id: string
  label: string
  dotColor: string
  badge?: { text: string; bg: string; color: string }
  headerButtons?: React.ReactNode
  onClose: () => void
  renderContent: () => React.ReactNode
}

export interface DocumentPanelsProps {
  selectedNodes: string[]
  treeItems: TreeItem[]
  docContents: Map<string, ParsedDocContent>
  expandedPanel: string | null
  setExpandedPanel: (id: string | null) => void
  closeNode: (id: string) => void
  onOpenFile?: (filePath: string, lineNumber?: number) => void
  resolvedSettings: ProjectSettings
  loadParsedDoc: (item: TreeItem) => void | Promise<void>
  onFullscreen: (state: FullscreenModalState) => void
  CodeViewer?: CodeViewerComponent
  /** Optional packet accordion section */
  packet?: PacketAccordionData
}

export function DocumentPanels({
  selectedNodes,
  treeItems,
  docContents,
  expandedPanel,
  setExpandedPanel,
  closeNode,
  onOpenFile,
  resolvedSettings,
  loadParsedDoc,
  onFullscreen,
  CodeViewer,
  packet,
}: DocumentPanelsProps) {
  const { colors } = useTheme()

  // Build unified panel entries list
  const panels: PanelEntry[] = []

  // Document panels
  for (const nodeId of selectedNodes) {
    const item = treeItems.find(t => t.id === nodeId)
    if (!item) continue

    panels.push({
      id: nodeId,
      label: item.name.replace('.md', ''),
      dotColor: item.is_dir ? colors.graphFolder : colors.accent,
      headerButtons: (!item.is_dir && onOpenFile) ? (
        <button
          onClick={(e) => { e.stopPropagation(); onOpenFile(item.path) }}
          style={{
            background: colors.accent,
            border: 'none',
            color: colors.textInverse,
            padding: '2px 8px',
            borderRadius: '3px',
            fontSize: '10px',
            cursor: 'pointer',
          }}
        >
          Edit
        </button>
      ) : undefined,
      onClose: () => closeNode(nodeId),
      renderContent: () => {
        const content = docContents.get(nodeId)
        if (content) {
          const docType = getDocType(item.id, resolvedSettings)
          const typeColor = docType === 'core' ? colors.graphCore :
                           docType === 'research' ? colors.graphResearch :
                           docType === 'spike' ? colors.graphSpike : colors.graphFolder
          return (
            <div style={{
              overflow: 'hidden',
              padding: '12px',
              background: colors.bgPrimary,
              ...layoutPrimitives.fillColumn,
            }}>
              <SectionView
                content={content.content}
                typeColor={typeColor}
                sections={content.sections}
                onFullscreen={onFullscreen}
                CodeViewer={CodeViewer}
              />
            </div>
          )
        }
        if (!item.is_dir) {
          void loadParsedDoc(item)
          return (
            <div style={{ padding: '12px', color: colors.textMuted }}>
              Loading...
            </div>
          )
        }
        return null
      },
    })
  }

  // Packet panel (if active)
  if (packet && packet.activePacketId) {
    panels.push({
      id: '__packet__',
      label: packet.packetName ?? packet.activePacketId,
      dotColor: '#8b5cf6',
      badge: { text: 'packet', bg: '#3b82f622', color: '#3b82f6' },
      headerButtons: (
        <button
          onClick={(e) => { e.stopPropagation(); packet.onRefresh() }}
          style={{
            background: colors.buttonBg,
            border: `1px solid ${colors.borderSecondary}`,
            color: colors.textSecondary,
            padding: '2px 6px',
            borderRadius: 3,
            cursor: 'pointer',
            fontSize: 10,
          }}
        >
          Refresh
        </button>
      ),
      onClose: () => packet.onClose(),
      renderContent: () => {
        if (packet.isLoading) {
          return (
            <div style={{ padding: 12, color: colors.textMuted, fontSize: 12 }}>
              Loading packet...
            </div>
          )
        }
        return (
          <div style={{ overflow: 'auto', background: colors.bgPrimary, ...layoutPrimitives.fillColumn }}>
            {/* Vectors */}
            {packet.vectors.length > 0 && (
              <div style={{ borderBottom: `1px solid ${colors.borderPrimary}`, padding: '10px 12px' }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
                  Vectors ({packet.vectors.length})
                </div>
                {packet.vectors.map(v => (
                  <div key={v.id} style={{ padding: '4px 0', borderBottom: `1px solid ${colors.borderSecondary}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 600, color: colors.textPrimary }}>{v.id}</span>
                      <span style={{
                        fontSize: 9, padding: '1px 4px', borderRadius: 2,
                        background: v.state === 'resolved' ? '#22c55e22' : '#3b82f622',
                        color: v.state === 'resolved' ? '#22c55e' : '#3b82f6',
                        fontWeight: 600, textTransform: 'uppercase',
                      }}>{v.state}</span>
                    </div>
                    <div style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>{v.current}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Nodes */}
            {packet.nodes.length > 0 && (
              <div style={{ borderBottom: `1px solid ${colors.borderPrimary}`, padding: '10px 12px' }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
                  Nodes ({packet.nodes.length})
                </div>
                {packet.nodes.map(n => (
                  <div key={n.nodeId} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: `1px solid ${colors.borderSecondary}` }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: getNodeStateColor(n.state as 'active' | 'success' | 'failed'), flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: 'monospace', fontSize: 11, fontWeight: 600, color: colors.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.nodeId}</div>
                      {n.layer && <div style={{ fontSize: 10, color: colors.textMuted }}>{n.layer}{n.subsystem ? ` / ${n.subsystem}` : ''}</div>}
                    </div>
                    <span style={{ fontSize: 9, color: getNodeStateColor(n.state as 'active' | 'success' | 'failed'), fontWeight: 600, textTransform: 'uppercase' }}>{n.state}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Recent Deltas */}
            {packet.deltas.length > 0 && (
              <div style={{ borderBottom: `1px solid ${colors.borderPrimary}`, padding: '10px 12px' }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 6 }}>
                  Recent Deltas ({packet.deltas.length})
                </div>
                {packet.deltas.slice(-5).reverse().map((d, i) => (
                  <div key={i} style={{ padding: '4px 0', borderBottom: `1px solid ${colors.borderSecondary}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                      <span style={{
                        fontSize: 9, padding: '1px 4px', borderRadius: 2,
                        background: `${deltaTypeColors[d.type] ?? deltaTypeColors.log}22`,
                        color: deltaTypeColors[d.type] ?? deltaTypeColors.log,
                        fontWeight: 600,
                      }}>{d.type}</span>
                      <span style={{ fontSize: 10, color: colors.textMuted, fontFamily: 'monospace' }}>{d.timestamp}</span>
                    </div>
                    <div style={{ fontSize: 11, color: colors.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.content}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Empty state when no vectors/nodes/deltas */}
            {packet.vectors.length === 0 && packet.nodes.length === 0 && packet.deltas.length === 0 && (
              <div style={{ padding: 12, color: colors.textMuted, fontSize: 11 }}>
                No packet data yet. AI will populate vectors, nodes, and deltas as it works.
              </div>
            )}
          </div>
        )
      },
    })
  }

  // Render all panels with the same accordion pattern
  return (
    <>
      {panels.map(panel => {
        const isExpanded = expandedPanel === panel.id
        return (
          <div key={panel.id} style={{
            ...layoutPrimitives.column,
            flex: isExpanded ? 1 : '0 0 auto',
            height: isExpanded ? '100%' : 'auto',
            minHeight: isExpanded ? 0 : 'auto',
            width: '100%',
            borderBottom: `1px solid ${colors.borderPrimary}`,
          }}>
            {/* Accordion header */}
            <div
              onClick={() => setExpandedPanel(isExpanded ? null : panel.id)}
              style={{
                padding: '8px 12px',
                ...layoutPrimitives.row,
                alignItems: 'center',
                gap: '8px',
                cursor: 'pointer',
                background: isExpanded ? colors.bgTertiary : colors.bgSecondary,
                userSelect: 'none',
              }}
            >
              <Icon icon={isExpanded ? icons.chevronDown : icons.chevronRight} size="xs" style={{ color: colors.textSecondary }} />
              <span style={{
                width: '10px',
                height: '10px',
                borderRadius: '50%',
                background: panel.dotColor,
              }} />
              <span style={{ color: colors.textPrimary, fontWeight: 600, fontSize: '12px', flex: 1 }}>
                {panel.label}
              </span>

              {panel.badge && (
                <span style={{
                  fontSize: 9,
                  padding: '1px 6px',
                  borderRadius: 3,
                  background: panel.badge.bg,
                  color: panel.badge.color,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                }}>
                  {panel.badge.text}
                </span>
              )}

              {panel.headerButtons}

              <button
                onClick={(e) => { e.stopPropagation(); panel.onClose() }}
                style={{
                  ...layoutPrimitives.row,
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'transparent',
                  border: 'none',
                  color: colors.textMuted,
                  cursor: 'pointer',
                }}
              >
                <Icon icon={icons.close} size="xs" />
              </button>
            </div>

            {/* Expanded content */}
            {isExpanded && panel.renderContent()}
          </div>
        )
      })}
    </>
  )
}
