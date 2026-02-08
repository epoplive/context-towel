import type { Dispatch, SetStateAction } from 'react'

import { useTheme } from '../../../compat/design-system'
import { layoutPrimitives } from '../../../compat/layoutPrimitives'

export type DocTypeKey = 'core' | 'research' | 'spike' | 'other'
export type DocTypeFilters = Record<DocTypeKey, boolean>

export interface DocTypeOption {
  key: DocTypeKey
  label: string
  color: string
}

export interface GraphControlPopoversProps {
  showLegend: boolean
  showFilters: boolean
  showIgnored: boolean
  showPinned: boolean

  docTypeOptions: DocTypeOption[]
  docTypeFilters: DocTypeFilters
  setDocTypeFilters: Dispatch<SetStateAction<DocTypeFilters>>
  showAllLinks: boolean
  setShowAllLinks: Dispatch<SetStateAction<boolean>>
  onResetFilters: () => void

  ignoredEntries: Array<{ id: string; label: string }>
  onRestoreIgnored: (id: string) => void
  onRestoreAllIgnored: () => void

  pinnedEntries: Array<{ id: string; label: string }>
  lockedNodes: Set<string>
  onFocusPinned: (id: string) => void
  onUnpin: (id: string) => void
  onToggleLock: (id: string) => void
  onClearPins: () => void
}

export function GraphControlPopovers({
  showLegend,
  showFilters,
  showIgnored,
  showPinned,
  docTypeOptions,
  docTypeFilters,
  setDocTypeFilters,
  showAllLinks,
  setShowAllLinks,
  onResetFilters,
  ignoredEntries,
  onRestoreIgnored,
  onRestoreAllIgnored,
  pinnedEntries,
  lockedNodes,
  onFocusPinned,
  onUnpin,
  onToggleLock,
  onClearPins,
}: GraphControlPopoversProps) {
  const { colors, shadows } = useTheme()

  return (
    <>
      {showLegend && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 6px)',
            background: colors.bgPrimary,
            border: `1px solid ${colors.borderSecondary}`,
            borderRadius: 8,
            padding: '8px 10px',
            boxShadow: shadows.md,
            zIndex: 20,
            minWidth: 160,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 600, color: colors.textSecondary, marginBottom: 6 }}>
            Legend
          </div>
          {docTypeOptions.map(option => (
            <div key={option.key} style={{ ...layoutPrimitives.row, alignItems: 'center', gap: 6, padding: '2px 0' }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 999,
                  background: option.color,
                }}
              />
              <span style={{ fontSize: 11, color: colors.textPrimary }}>{option.label}</span>
            </div>
          ))}
          <div style={{ marginTop: 6, fontSize: 10, color: colors.textSecondary }}>
            Link Edges
          </div>
          <div style={{ ...layoutPrimitives.row, alignItems: 'center', gap: 6, padding: '2px 0' }}>
            <span
              style={{
                width: 18,
                height: 0,
                borderTop: `2px dashed ${colors.warning}`,
              }}
            />
            <span style={{ fontSize: 11, color: colors.textPrimary }}>Links</span>
          </div>
        </div>
      )}

      {showFilters && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 6px)',
            background: colors.bgPrimary,
            border: `1px solid ${colors.borderSecondary}`,
            borderRadius: 8,
            padding: '8px 10px',
            boxShadow: shadows.md,
            zIndex: 20,
            minWidth: 180,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 600, color: colors.textSecondary, marginBottom: 6 }}>
            Document Types
          </div>
          {docTypeOptions.map(option => {
            const isActive = docTypeFilters[option.key]
            return (
              <button
                key={option.key}
                type="button"
                onClick={() => setDocTypeFilters(prev => ({ ...prev, [option.key]: !prev[option.key] }))}
                style={{
                  ...layoutPrimitives.row,
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  padding: '4px 6px',
                  borderRadius: 6,
                  border: `1px solid ${isActive ? colors.accent : colors.borderSecondary}`,
                  background: isActive ? colors.bgSecondary : 'transparent',
                  color: isActive ? colors.textPrimary : colors.textMuted,
                  cursor: 'pointer',
                  fontSize: 11,
                  marginBottom: 4,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: isActive ? option.color : colors.borderSecondary,
                  }}
                />
                {option.label}
              </button>
            )
          })}
          <div style={{ marginTop: 6, fontSize: 11, fontWeight: 600, color: colors.textSecondary }}>
            Link Edges
          </div>
          <button
            type="button"
            onClick={() => setShowAllLinks(prev => !prev)}
            style={{
              marginTop: 4,
              width: '100%',
              border: `1px solid ${showAllLinks ? colors.warning : colors.borderSecondary}`,
              background: showAllLinks ? `${colors.warning}20` : colors.buttonBg,
              color: showAllLinks ? colors.textPrimary : colors.textSecondary,
              padding: '4px 6px',
              borderRadius: 6,
              fontSize: 10,
              cursor: 'pointer',
            }}
          >
            {showAllLinks ? 'Show working-only links' : 'Show all links'}
          </button>
          <button
            type="button"
            onClick={onResetFilters}
            style={{
              marginTop: 4,
              width: '100%',
              border: `1px solid ${colors.borderSecondary}`,
              background: colors.buttonBg,
              color: colors.textSecondary,
              padding: '4px 6px',
              borderRadius: 6,
              fontSize: 10,
              cursor: 'pointer',
            }}
          >
            Reset
          </button>
        </div>
      )}

      {showIgnored && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 6px)',
            background: colors.bgPrimary,
            border: `1px solid ${colors.borderSecondary}`,
            borderRadius: 8,
            padding: '8px 10px',
            boxShadow: shadows.md,
            zIndex: 20,
            minWidth: 200,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 600, color: colors.textSecondary, marginBottom: 6 }}>
            Ignored Items
          </div>
          {ignoredEntries.length === 0 ? (
            <div style={{ fontSize: 11, color: colors.textMuted }}>No ignored nodes</div>
          ) : (
            <div style={{ display: 'grid', gap: 6 }}>
              {ignoredEntries.map(entry => (
                <div key={entry.id} style={{ ...layoutPrimitives.row, alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 11, color: colors.textPrimary }}>{entry.label}</span>
                  <button
                    type="button"
                    onClick={() => onRestoreIgnored(entry.id)}
                    style={{
                      border: 'none',
                      background: colors.buttonBg,
                      color: colors.textSecondary,
                      fontSize: 10,
                      padding: '2px 6px',
                      borderRadius: 4,
                      cursor: 'pointer',
                    }}
                  >
                    Restore
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={onRestoreAllIgnored}
                style={{
                  border: `1px solid ${colors.borderSecondary}`,
                  background: colors.buttonBg,
                  color: colors.textSecondary,
                  fontSize: 10,
                  padding: '4px 6px',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                Restore all
              </button>
            </div>
          )}
        </div>
      )}

      {showPinned && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 6px)',
            background: colors.bgPrimary,
            border: `1px solid ${colors.borderSecondary}`,
            borderRadius: 8,
            padding: '8px 10px',
            boxShadow: shadows.md,
            zIndex: 20,
            minWidth: 220,
          }}
        >
          <div style={{ fontSize: 11, fontWeight: 600, color: colors.textSecondary, marginBottom: 6 }}>
            Pinned Items
          </div>
          {pinnedEntries.length === 0 ? (
            <div style={{ fontSize: 11, color: colors.textMuted }}>No pinned nodes</div>
          ) : (
            <div style={{ display: 'grid', gap: 6 }}>
              {pinnedEntries.map(entry => (
                <div key={entry.id} style={{ display: 'grid', gap: 4 }}>
                  <div style={{ ...layoutPrimitives.row, alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                    <span style={{ fontSize: 11, color: colors.textPrimary }}>{entry.label}</span>
                    <div style={{ ...layoutPrimitives.row, alignItems: 'center', gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => onFocusPinned(entry.id)}
                        style={{
                          border: `1px solid ${colors.borderSecondary}`,
                          background: colors.buttonBg,
                          color: colors.textSecondary,
                          fontSize: 10,
                          padding: '2px 6px',
                          borderRadius: 4,
                          cursor: 'pointer',
                        }}
                      >
                        Focus
                      </button>
                      <button
                        type="button"
                        onClick={() => onUnpin(entry.id)}
                        style={{
                          border: 'none',
                          background: colors.buttonBg,
                          color: colors.textSecondary,
                          fontSize: 10,
                          padding: '2px 6px',
                          borderRadius: 4,
                          cursor: 'pointer',
                        }}
                      >
                        Unpin
                      </button>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onToggleLock(entry.id)}
                    style={{
                      border: `1px solid ${colors.borderSecondary}`,
                      background: lockedNodes.has(entry.id) ? colors.bgSecondary : colors.buttonBg,
                      color: colors.textSecondary,
                      fontSize: 10,
                      padding: '2px 6px',
                      borderRadius: 4,
                      cursor: 'pointer',
                      alignSelf: 'flex-start',
                    }}
                  >
                    {lockedNodes.has(entry.id) ? 'Unlock position' : 'Lock position'}
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={onClearPins}
                style={{
                  border: `1px solid ${colors.borderSecondary}`,
                  background: colors.buttonBg,
                  color: colors.textSecondary,
                  fontSize: 10,
                  padding: '4px 6px',
                  borderRadius: 6,
                  cursor: 'pointer',
                }}
              >
                Clear pins
              </button>
            </div>
          )}
        </div>
      )}
    </>
  )
}

