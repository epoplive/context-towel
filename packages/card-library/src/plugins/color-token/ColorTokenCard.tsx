import { memo } from 'react'
import { Palette } from 'lucide-react'
import type { BlockRenderProps } from '../../blocks/types'
import type { ColorTokenBlockData } from './types'

function contrastColor(hex: string): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.5 ? '#000000' : '#ffffff'
}

export const ColorTokenCard = memo(function ColorTokenCard({
  data,
  detail,
  theme,
  onEdit,
}: BlockRenderProps<ColorTokenBlockData>) {
  const swatchSize = detail === 'mini' ? 14 : detail === 'summary' ? 20 : 32

  if (detail === 'mini') {
    return (
      <div style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '2px 6px',
        background: theme.bgSecondary,
        borderRadius: theme.radius,
        fontFamily: theme.fontSans,
      }}>
        <div style={{
          width: swatchSize, height: swatchSize, borderRadius: 4,
          background: data.value,
          border: `1px solid ${theme.borderSecondary}`,
        }} />
        <span style={{ fontSize: '0.85em', color: theme.textPrimary }}>{data.name}</span>
      </div>
    )
  }

  if (detail === 'summary') {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 8px',
        background: theme.bgSecondary,
        borderRadius: theme.radius,
        fontFamily: theme.fontSans,
      }}>
        <div style={{
          width: swatchSize, height: swatchSize, borderRadius: 6,
          background: data.value,
          border: `1px solid ${theme.borderSecondary}`,
        }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.9em', fontWeight: 600, color: theme.textPrimary }}>{data.name}</div>
          <div style={{ fontSize: '0.75em', color: theme.textMuted, fontFamily: theme.fontMono }}>{data.value}</div>
        </div>
        {data.role && (
          <span style={{
            fontSize: '0.7em', padding: '1px 5px', borderRadius: 3,
            background: `${theme.accent}15`, color: theme.accent,
          }}>
            {data.role}
          </span>
        )}
      </div>
    )
  }

  // detail === 'full'
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      padding: '8px 12px',
      background: theme.bgSecondary,
      borderRadius: theme.radius,
      fontFamily: theme.fontSans,
    }}>
      {/* Light mode swatch */}
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: swatchSize, height: swatchSize, borderRadius: 8,
          background: data.value,
          border: `1px solid ${theme.borderSecondary}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: onEdit ? 'pointer' : 'default',
        }}>
          <span style={{
            fontSize: '0.55em', fontWeight: 700, fontFamily: theme.fontMono,
            color: contrastColor(data.value),
          }}>
            {data.value}
          </span>
        </div>
        <div style={{ fontSize: '0.6em', color: theme.textMuted, marginTop: 2 }}>light</div>
      </div>

      {/* Dark mode swatch */}
      {data.darkValue && (
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: swatchSize, height: swatchSize, borderRadius: 8,
            background: data.darkValue,
            border: `1px solid ${theme.borderSecondary}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{
              fontSize: '0.55em', fontWeight: 700, fontFamily: theme.fontMono,
              color: contrastColor(data.darkValue),
            }}>
              {data.darkValue}
            </span>
          </div>
          <div style={{ fontSize: '0.6em', color: theme.textMuted, marginTop: 2 }}>dark</div>
        </div>
      )}

      {/* Name + metadata */}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.95em', fontWeight: 600, color: theme.textPrimary }}>{data.name}</div>
        <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
          {data.role && (
            <span style={{
              fontSize: '0.7em', padding: '1px 5px', borderRadius: 3,
              background: `${theme.accent}15`, color: theme.accent,
            }}>
              {data.role}
            </span>
          )}
          {data.group && (
            <span style={{
              fontSize: '0.7em', padding: '1px 5px', borderRadius: 3,
              background: theme.bgTertiary, color: theme.textMuted,
            }}>
              {data.group}
            </span>
          )}
        </div>
      </div>
    </div>
  )
})
