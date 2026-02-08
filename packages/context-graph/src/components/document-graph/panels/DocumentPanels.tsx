import type { CodeViewerComponent, FullscreenModalState } from '@context-towel/markdown'

import type { ProjectSettings } from '../../../compat/project-settings'
import { useTheme, Icon, icons } from '../../../compat/design-system'
import { layoutPrimitives } from '../../../compat/layoutPrimitives'
import { getDocType } from '../../../state/layoutUtils'
import type { ParsedDocContent } from '../../../state/slices/types'
import type { TreeItem } from '../../../types'
import { SectionView } from '../SectionView'

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
}: DocumentPanelsProps) {
  const { colors } = useTheme()

  return (
    <>
      {selectedNodes.map(nodeId => {
        const item = treeItems.find(t => t.id === nodeId)
        const content = docContents.get(nodeId)
        if (!item) return null

        const isExpanded = expandedPanel === nodeId

        return (
          <div key={nodeId} style={{
            ...layoutPrimitives.column,
            flex: isExpanded ? 1 : '0 0 auto',
            height: isExpanded ? '100%' : 'auto',
            minHeight: isExpanded ? 0 : 'auto',
            width: '100%',
            borderBottom: `1px solid ${colors.borderPrimary}`,
          }}>
            <div
              onClick={() => setExpandedPanel(isExpanded ? null : nodeId)}
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
                background: item.is_dir ? colors.graphFolder : colors.accent,
              }} />
              <span style={{ color: colors.textPrimary, fontWeight: 600, fontSize: '12px', flex: 1 }}>
                {item.name.replace('.md', '')}
              </span>

              {!item.is_dir && onOpenFile && (
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
              )}

              <button
                onClick={(e) => { e.stopPropagation(); closeNode(nodeId) }}
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

            {isExpanded && content && (() => {
              // Determine type color for this document
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
            })()}

            {isExpanded && !content && !item.is_dir && (
              <div style={{ padding: '12px', color: colors.textMuted }}>
                Loading...
                {/* Request content if not loaded */}
                {(() => {
                  void loadParsedDoc(item)
                  return null
                })()}
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}
