import { memo } from 'react'
import { Lightbulb } from 'lucide-react'
import type { BlockRenderProps } from '../../blocks/types'
import type { PatternBlockData } from './types'

const PRIORITY_COLORS: Record<string, string> = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#6b7280',
}

const TYPE_COLORS: Record<string, string> = {
  ui: '#3b82f6',
  ux: '#8b5cf6',
  architecture: '#ec4899',
  data_model: '#14b8a6',
  integration: '#f97316',
}

export const PatternCard = memo(function PatternCard({
  data,
  detail,
  theme,
}: BlockRenderProps<PatternBlockData>) {
  const typeColor = TYPE_COLORS[data.type ?? ''] ?? '#6366f1'
  const priorityColor = PRIORITY_COLORS[data.priority ?? ''] ?? '#6b7280'

  if (detail === 'mini') {
    return (
      <div style={{
        borderLeft: `3px solid ${typeColor}`,
        padding: '4px 8px',
        background: theme.bgSecondary,
        borderRadius: theme.radius,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: theme.fontSans,
      }}>
        <Lightbulb size={10} color={typeColor} style={{ flexShrink: 0 }} />
        <span style={{ fontSize: '0.95em', color: theme.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {data.name}
        </span>
      </div>
    )
  }

  if (detail === 'summary') {
    return (
      <div style={{
        borderLeft: `3px solid ${typeColor}`,
        padding: '6px 8px',
        background: theme.bgSecondary,
        borderRadius: theme.radius,
        fontFamily: theme.fontSans,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Lightbulb size={10} color={typeColor} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: '0.95em', color: theme.textPrimary, fontWeight: 600, flex: 1 }}>
            {data.name}
          </span>
          {data.priority && (
            <span style={{
              fontSize: '0.7em', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px',
              padding: '1px 5px', borderRadius: 3, background: `${priorityColor}22`, color: priorityColor,
            }}>
              {data.priority}
            </span>
          )}
        </div>
      </div>
    )
  }

  // detail === 'full'
  return (
    <div style={{
      borderLeft: `3px solid ${typeColor}`,
      padding: '10px 12px',
      background: theme.bgSecondary,
      borderRadius: theme.radius,
      fontFamily: theme.fontSans,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        <Lightbulb size={14} color={typeColor} style={{ flexShrink: 0 }} />
        <span style={{ fontSize: '1em', color: theme.textPrimary, fontWeight: 600, flex: 1 }}>
          {data.name}
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          {data.type && (
            <span style={{
              fontSize: '0.7em', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px',
              padding: '1px 5px', borderRadius: 3, background: `${typeColor}22`, color: typeColor,
            }}>
              {data.type}
            </span>
          )}
          {data.priority && (
            <span style={{
              fontSize: '0.7em', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px',
              padding: '1px 5px', borderRadius: 3, background: `${priorityColor}22`, color: priorityColor,
            }}>
              {data.priority}
            </span>
          )}
        </div>
      </div>

      {/* Description */}
      {data.description && (
        <div style={{ fontSize: '0.9em', color: theme.textSecondary, marginBottom: 6, lineHeight: 1.5 }}>
          {data.description}
        </div>
      )}

      {/* Source */}
      {data.source && (
        <div style={{ fontSize: '0.8em', color: theme.textMuted, marginBottom: 4 }}>
          <strong>Source:</strong> {data.source}
        </div>
      )}

      {/* Adaptation */}
      {data.adaptation && (
        <div style={{ fontSize: '0.8em', color: theme.textMuted }}>
          <strong>Adaptation:</strong> {data.adaptation}
        </div>
      )}
    </div>
  )
})
