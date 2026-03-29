import { memo, useEffect } from 'react'
import { Type } from 'lucide-react'
import type { BlockRenderProps } from '../../blocks/types'
import type { TypographyBlockData } from './types'

const ROLE_COLORS: Record<string, string> = {
  heading: '#6366f1',
  body: '#3b82f6',
  mono: '#14b8a6',
  display: '#ec4899',
}

/** Load a Google Font dynamically */
function loadGoogleFont(fontFamily: string) {
  if (typeof document === 'undefined') return
  const id = `gf-${fontFamily.replace(/\s+/g, '-').toLowerCase()}`
  if (document.getElementById(id)) return
  const link = document.createElement('link')
  link.id = id
  link.rel = 'stylesheet'
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily)}:wght@300;400;500;600;700&display=swap`
  document.head.appendChild(link)
}

export const TypographyCard = memo(function TypographyCard({
  data,
  detail,
  theme,
  onEdit,
}: BlockRenderProps<TypographyBlockData>) {
  const roleColor = ROLE_COLORS[data.role ?? ''] ?? '#6b7280'
  const sampleText = data.sampleText ?? 'The quick brown fox jumps over the lazy dog'
  const fontWeight = Number(data.weight ?? 400)

  // Load the font from Google Fonts
  useEffect(() => {
    if (data.fontFamily && !data.fontFamily.includes('system') && !data.fontFamily.includes('monospace')) {
      loadGoogleFont(data.fontFamily)
    }
  }, [data.fontFamily])

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
          fontFamily: data.fontFamily, fontWeight,
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
              wt {data.weight}
            </span>
          )}
          {data.size && (
            <span style={{
              fontSize: '0.7em', padding: '1px 5px', borderRadius: 3,
              background: theme.bgTertiary, color: theme.textMuted,
            }}>
              {data.size}
            </span>
          )}
        </div>
      </div>

      {/* Font specimens at multiple sizes — rendered in the actual font */}
      <div style={{ fontFamily: data.fontFamily, color: theme.textPrimary }}>
        {/* Large heading specimen */}
        <div style={{ fontSize: '1.8em', fontWeight, marginBottom: 6, lineHeight: 1.2 }}>
          {sampleText}
        </div>
        {/* Body text specimen */}
        <div style={{ fontSize: '1em', fontWeight: Math.min(fontWeight, 400), marginBottom: 6, lineHeight: 1.5, color: theme.textSecondary }}>
          {sampleText}
        </div>
        {/* Small text specimen */}
        <div style={{ fontSize: '0.85em', fontWeight: Math.min(fontWeight, 400), lineHeight: 1.5, color: theme.textMuted }}>
          {sampleText}
        </div>
        {/* Character set */}
        <div style={{
          fontSize: '0.75em', fontWeight: 400, lineHeight: 1.6, color: theme.textMuted,
          marginTop: 6, paddingTop: 6, borderTop: `1px solid ${theme.borderSecondary}`,
        }}>
          ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz 0123456789 !@#$%&amp;*()
        </div>
      </div>

      {/* Weight specimens */}
      <div style={{
        display: 'flex', gap: 12, marginTop: 8, paddingTop: 8,
        borderTop: `1px solid ${theme.borderSecondary}`, flexWrap: 'wrap',
      }}>
        {[300, 400, 500, 600, 700].map((w) => (
          <div key={w} style={{ fontFamily: data.fontFamily, textAlign: 'center' }}>
            <div style={{ fontSize: '1em', fontWeight: w, color: theme.textPrimary }}>Aa</div>
            <div style={{ fontSize: '0.6em', color: theme.textMuted }}>{w}</div>
          </div>
        ))}
      </div>
    </div>
  )
})
