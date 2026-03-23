// ============================================================================
// Comp Map Plugin Components — Symbol table card
// ============================================================================

import { memo, useMemo } from 'react'
import { Handle, Position } from '@xyflow/react'
import { useTheme } from '../../compat/design-system'
import type { CompMapItem } from './types'

export interface CompMapNodeData {
  compMap: CompMapItem
  parentDocId: string
  cardScale?: number
}

const EdgeHandles = memo(({ color }: { color: string }) => (
  <>
    <Handle type="target" id="top" position={Position.Top} style={{ background: color }} />
    <Handle type="target" id="left" position={Position.Left} style={{ background: color }} />
    <Handle type="source" id="right" position={Position.Right} style={{ background: color }} />
    <Handle type="source" id="bottom" position={Position.Bottom} style={{ background: color }} />
  </>
))

export const CompMapNode = memo(({ data, selected }: { data: CompMapNodeData; selected?: boolean }) => {
  const { colors } = useTheme()
  const scale = data.cardScale ?? 1.0
  const { compMap } = data

  const accent = '#a78bfa' // purple for comp maps

  const sortedSymbols = useMemo(() =>
    [...compMap.symbols].sort((a, b) => a.symbol.localeCompare(b.symbol)),
    [compMap.symbols],
  )

  return (
    <div style={{
      background: colors.bgSecondary,
      border: `2px solid ${selected ? accent : colors.borderPrimary}`,
      borderLeft: `6px solid ${accent}`,
      borderRadius: 10,
      padding: 12,
      minWidth: 200,
      maxWidth: 280,
      cursor: 'default',
      transform: `scale(${scale})`,
      transformOrigin: 'top left',
    }}>
      <EdgeHandles color={accent} />

      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
        borderBottom: `1px solid ${colors.borderPrimary}`,
        paddingBottom: 6,
      }}>
        <span style={{
          fontSize: 10,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          padding: '2px 6px',
          borderRadius: 4,
          background: `${accent}22`,
          color: accent,
        }}>
          MAP
        </span>
        <span style={{
          fontSize: 13,
          fontWeight: 600,
          color: colors.textPrimary,
          fontFamily: 'monospace',
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {compMap.mapId}
        </span>
        {compMap.parentId && (
          <span style={{
            fontSize: 9,
            color: colors.textMuted,
            fontStyle: 'italic',
          }}>
            uses {compMap.parentId}
          </span>
        )}
      </div>

      {/* Symbol table */}
      <div style={{
        background: colors.bgPrimary,
        borderRadius: 6,
        padding: 8,
        maxHeight: 200,
        overflow: 'auto',
      }}>
        {sortedSymbols.map(({ symbol, expansion }, i) => (
          <div key={i} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '2px 0',
            fontSize: 12,
            fontFamily: 'monospace',
          }}>
            <span style={{
              color: colors.textPrimary,
              fontWeight: 600,
              minWidth: 24,
              textAlign: 'center',
            }}>
              {symbol}
            </span>
            <span style={{
              color: colors.textMuted,
              fontSize: 10,
            }}>
              =
            </span>
            <span style={{
              color: colors.textSecondary,
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {expansion}
            </span>
          </div>
        ))}
        {sortedSymbols.length === 0 && (
          <span style={{ fontSize: 11, color: colors.textMuted, fontStyle: 'italic' }}>
            Empty map
          </span>
        )}
      </div>
    </div>
  )
})
