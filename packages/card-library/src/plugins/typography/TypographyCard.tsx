import { memo } from 'react'
import { Type } from 'lucide-react'
import type { BlockRenderProps } from '../../blocks/types'
import type { TypographyBlockData } from './types'

const ROLE_COLORS: Record<string, string> = {
  heading: '#6366f1',
  body: '#3b82f6',
  mono: '#14b8a6',
  display: '#ec4899',
}

export const TypographyCard = memo(function TypographyCard({
  data,
  detail,
  theme,
}: BlockRenderProps<TypographyBlockData>) {
  const roleColor = ROLE_COLORS[data.role ?? ''] ?? '#6b7280'
  const sampleText = data.sampleText ?? 'The quick brown fox jumps over the lazy dog'
  const fontWeight = data.weight ?? 400
  const fontSize = data.size ?? '1em'

  if (detail === 'mini') {
    return (
      <div style={{
        borderLeft: `3px solid ${roleColor}`,
        padding: '4px 8px',
        background: theme.bgSecondary,
        borderRadius: theme.radius,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: theme.fontSans,
      }}>
        <Type size={10} color={roleColor} style={{ flexShrink: 0 }} />
        <span style={{ fontSize: '0.95em', color: theme.textPrimary, fontFamily: data.fontFamily }}>
          {data.fontFamily}
        </span>
      </div>
    )
  }

  if (detail === 'summary') {
    return (
      <div style={{
        borderLeft: `3px solid ${roleColor}`,
        padding: '6px 8px',
        background: theme.bgSecondary,
        borderRadius: theme.radius,
        fontFamily: theme.fontSans,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Type size={10} color={roleColor} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: '0.95em', color: theme.textPrimary, fontWeight: 600 }}>
            {data.fontFamily}
          </span>
          {data.role && (
            <span style={{
              fontSize: '0.7em', fontWeight: 700, textTransform: 'uppercase',
              padding: '1px 5px', borderRadius: 3, background: `${roleColor}22`, color: roleColor,
            }}>
              {data.role}
            </span>
          )}
        </div>
        <div style={{
          fontSize: '0.9em', color: theme.textSecondary, marginTop: 4,
          fontFamily: data.fontFamily, fontWeight: Number(fontWeight),
        }}>
          {sampleText.slice(0, 40)}
        </div>
      </div>
    )
  }

  // detail === 'full'
  return (
    <div style={{
      borderLeft: `3px solid ${roleColor}`,
      padding: '10px 12px',
      background: theme.bgSecondary,
      borderRadius: theme.radius,
      fontFamily: theme.fontSans,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Type size={14} color={roleColor} style={{ flexShrink: 0 }} />
        <span style={{ fontSize: '1em', color: theme.textPrimary, fontWeight: 600, flex: 1 }}>
          {data.fontFamily}
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          {data.role && (
            <span style={{
              fontSize: '0.7em', fontWeight: 700, textTransform: 'uppercase',
              padding: '1px 5px', borderRadius: 3, background: `${roleColor}22`, color: roleColor,
            }}>
              {data.role}
            </span>
          )}
          {data.weight && (
            <span style={{
              fontSize: '0.7em', padding: '1px 5px', borderRadius: 3,
              background: theme.bgTertiary, color: theme.textMuted,
            }}>
              {data.weight}
            </span>
          )}
        </div>
      </div>

      {/* Font samples at different sizes */}
      <div style={{ fontFamily: data.fontFamily, color: theme.textPrimary }}>
        <div style={{ fontSize: '1.5em', fontWeight: Number(fontWeight), marginBottom: 4, lineHeight: 1.3 }}>
          {sampleText}
        </div>
        <div style={{ fontSize: '1em', fontWeight: Number(fontWeight), marginBottom: 4, lineHeight: 1.4, color: theme.textSecondary }}>
          {sampleText}
        </div>
        <div style={{ fontSize: '0.8em', fontWeight: Number(fontWeight), lineHeight: 1.5, color: theme.textMuted }}>
          ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789
        </div>
      </div>

      {/* Metadata */}
      <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: '0.75em', color: theme.textMuted }}>
        {data.size && <span>Size: {data.size}</span>}
        {data.weight && <span>Weight: {data.weight}</span>}
      </div>
    </div>
  )
})
