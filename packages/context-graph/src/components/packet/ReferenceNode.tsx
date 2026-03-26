// ============================================================================
// ReferenceNode — Compact pill for reference-type AICCL nodes
//
// Shows a file path or URL as a small connected pill. These attach
// to work nodes via edges and show what documentation/files are relevant.
// ============================================================================

import { memo } from 'react'
import { useTheme } from '../../compat/design-system'
import { PillHandles, shortPath, isUrl, PACKET_COLORS } from './primitives'

export interface ReferenceNodeData {
  path: string
  body?: string
  state?: string
}

const FILE_ICON = (color: string) => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
    <path d="M2 1.5h5l3 3v6a1 1 0 01-1 1H2a1 1 0 01-1-1v-8a1 1 0 011-1z"
      stroke={color} strokeWidth="1" fill={`${color}15`} />
    <path d="M7 1.5v3h3" stroke={color} strokeWidth="1" />
  </svg>
)

const LINK_ICON = (color: string) => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
    <path d="M5 7l2-2M4.5 8.5l-1 1a1.4 1.4 0 01-2-2l1-1M7.5 3.5l1-1a1.4 1.4 0 012 2l-1 1"
      stroke={color} strokeWidth="1.2" strokeLinecap="round" />
  </svg>
)

export const ReferenceNode = memo(({ data, selected }: { data: ReferenceNodeData; selected?: boolean }) => {
  const { colors } = useTheme()
  const accent = PACKET_COLORS.blue
  const url = isUrl(data.path)

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      background: colors.bgSecondary,
      border: `1.5px solid ${selected ? accent : colors.borderPrimary}`,
      borderLeft: `3px solid ${accent}`,
      borderRadius: 8,
      padding: '6px 10px',
      minWidth: 120,
      maxWidth: 260,
      cursor: 'default',
    }}>
      <PillHandles color={accent} />

      {url ? LINK_ICON(accent) : FILE_ICON(accent)}

      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
        <div style={{
          fontSize: 8,
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          color: accent,
          marginBottom: 1,
        }}>
          {url ? 'URL' : 'REF'}
        </div>
        <div style={{
          fontSize: 10,
          fontFamily: 'monospace',
          color: colors.textSecondary,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
          title={data.path}
        >
          {shortPath(data.path)}
        </div>
      </div>
    </div>
  )
})
