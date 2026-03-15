import { memo } from 'react'
import type { BlockRenderProps } from '../../blocks/types'
import type { ChecklistGroupData } from './types'

export const ChecklistCard = memo(function ChecklistCard({
  data,
  detail,
  theme,
  onEdit,
}: BlockRenderProps<ChecklistGroupData>) {
  const completedCount = data.items.filter((i) => i.checked).length
  const totalCount = data.items.length
  const pct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0
  const barColor = pct === 100 ? theme.success : theme.accent

  if (detail === 'mini') {
    return (
      <div style={{
        padding: '4px 8px',
        background: theme.bgSecondary,
        borderRadius: theme.radius,
        borderLeft: `3px solid ${barColor}`,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: theme.fontSans,
      }}>
        <span style={{ fontSize: '0.95em', color: theme.textPrimary, flex: 1 }}>{data.title}</span>
        <span style={{ fontSize: '0.85em', color: barColor, fontWeight: 600 }}>{completedCount}/{totalCount}</span>
      </div>
    )
  }

  const itemsToShow = detail === 'summary' ? data.items.slice(0, 5) : data.items

  return (
    <div style={{
      padding: '8px 10px',
      background: theme.bgSecondary,
      borderRadius: theme.radius,
      borderLeft: `3px solid ${barColor}`,
      fontFamily: theme.fontSans,
    }}>
      {/* Title + progress */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: '0.95em', color: theme.textPrimary, fontWeight: 600, flex: 1 }}>
          {data.title}
        </span>
        <span style={{ fontSize: '0.85em', color: barColor, fontWeight: 600 }}>
          {completedCount}/{totalCount}
        </span>
      </div>

      {/* Progress bar */}
      <div style={{
        height: 3,
        borderRadius: 2,
        background: theme.bgTertiary,
        overflow: 'hidden',
        marginBottom: 6,
      }}>
        <div style={{
          width: `${pct}%`,
          height: '100%',
          background: barColor,
          borderRadius: 2,
          transition: 'width 0.2s',
        }} />
      </div>

      {/* Items */}
      {itemsToShow.map((item, i) => (
        <div
          key={i}
          onClick={onEdit ? () => onEdit({
            blockType: 'checklist',
            field: `items.${i}.checked`,
            value: !item.checked,
          }) : undefined}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 5,
            padding: '1px 0',
            cursor: onEdit ? 'pointer' : 'default',
            fontSize: '0.9em',
          }}
        >
          <span style={{
            fontSize: '0.95em',
            lineHeight: '14px',
            color: item.checked ? theme.success : theme.textMuted,
            flexShrink: 0,
          }}>
            {item.checked ? '\u2611' : '\u2610'}
          </span>
          <span style={{
            color: item.checked ? theme.textMuted : theme.textPrimary,
            textDecoration: item.checked ? 'line-through' : 'none',
            lineHeight: '14px',
          }}>
            {item.text}
          </span>
        </div>
      ))}
      {detail === 'summary' && data.items.length > 5 && (
        <div style={{ fontSize: '0.8em', color: theme.textMuted, paddingLeft: 16, marginTop: 2 }}>
          +{data.items.length - 5} more
        </div>
      )}
    </div>
  )
})
