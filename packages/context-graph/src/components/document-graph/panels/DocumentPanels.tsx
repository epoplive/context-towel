import type { FullscreenModalState } from '@context-towel/markdown'
import { ReactFlowProvider } from '@xyflow/react'
import { PacketWorkspace } from '../../PacketWorkspace'

import type { ProjectSettings } from '../../../compat/project-settings'
import { useTheme, Icon, icons } from '../../../compat/design-system'
import { layoutPrimitives } from '../../../compat/layoutPrimitives'
import type { ParsedDocContent } from '../../../state/slices/types'
import type { TreeItem } from '../../../types'
import type { ProblemVectorEntry, DeltaLogEntry } from '../../packet/parsePacketContent'
import type { NodeSummary } from '../../../hooks/usePacketPanel'

export interface PacketAccordionData {
  activePacketId: string | null
  packetName: string | null
  rawContent: string | null
  packetPath: string
  vectors: ProblemVectorEntry[]
  nodes: NodeSummary[]
  deltas: DeltaLogEntry[]
  isLoading: boolean
  onRefresh: () => void
  onClose: () => void
  onOpenSource?: (file: string, line?: number) => void
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
  /** Render the document view for a given file path. When provided, this replaces
   *  the default loading placeholder with the host's full document viewer (FileViewer). */
  renderDocumentView?: (filePath: string) => React.ReactNode
  /** Render extra controls (e.g. view mode toggle) in the accordion header for a document */
  renderDocumentHeaderControls?: (filePath: string) => React.ReactNode
  resolvedSettings: ProjectSettings
  loadParsedDoc: (item: TreeItem) => void | Promise<void>
  /** @deprecated Milkdown handles fullscreen internally */
  onFullscreen: (state: FullscreenModalState) => void
  /** @deprecated Milkdown handles code viewing internally */
  CodeViewer?: unknown
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
  renderDocumentView,
  renderDocumentHeaderControls,
  loadParsedDoc,
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
      headerButtons: (!item.is_dir && renderDocumentHeaderControls) ? renderDocumentHeaderControls(item.path) : undefined,
      onClose: () => closeNode(nodeId),
      renderContent: () => {
        // If host provides a document viewer, use it
        if (renderDocumentView && !item.is_dir) {
          return (
            <div style={{
              flex: 1,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              background: colors.bgPrimary,
            }}>
              {renderDocumentView(item.path)}
            </div>
          )
        }
        // Fallback: trigger load and show placeholder
        const content = docContents.get(nodeId)
        if (content) {
          return (
            <div style={{
              flex: 1,
              overflow: 'auto',
              padding: '16px 24px',
              background: colors.bgPrimary,
              color: colors.textPrimary,
              fontSize: 13,
              whiteSpace: 'pre-wrap',
            }}>
              {content.content}
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

        if (!packet.rawContent) {
          return (
            <div style={{ padding: 16, color: colors.textMuted, fontSize: 11, textAlign: 'center' }}>
              Empty packet. Use <code style={{ fontSize: 10, background: colors.bgTertiary, padding: '1px 4px', borderRadius: 3 }}>/packet-new</code> in Claude Code to seed it.
            </div>
          )
        }

        return (
          <ReactFlowProvider>
            <PacketWorkspace
              packetContent={packet.rawContent}
              packetName={packet.packetName ?? packet.activePacketId ?? 'Packet'}
              packetPath={packet.packetPath}
              isVisible={true}
            />
          </ReactFlowProvider>
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
            minHeight: isExpanded ? 0 : 'auto',
            overflow: isExpanded ? 'hidden' : undefined,
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
