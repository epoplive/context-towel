import { memo } from 'react'
import { Globe, ExternalLink, ThumbsUp, ThumbsDown } from 'lucide-react'
import type { BlockRenderProps } from '../../blocks/types'
import type { CompetitorBlockData } from './types'

export const CompetitorCard = memo(function CompetitorCard({
  data,
  detail,
  theme,
}: BlockRenderProps<CompetitorBlockData>) {
  const accentColor = '#6366f1' // indigo

  if (detail === 'mini') {
    return (
      <div style={{
        borderLeft: `3px solid ${accentColor}`,
        padding: '4px 8px',
        background: theme.bgSecondary,
        borderRadius: theme.radius,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: theme.fontSans,
      }}>
        <Globe size={10} color={accentColor} style={{ flexShrink: 0 }} />
        <span style={{ fontSize: '0.95em', color: theme.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {data.name}
        </span>
      </div>
    )
  }

  if (detail === 'summary') {
    return (
      <div style={{
        borderLeft: `3px solid ${accentColor}`,
        padding: '6px 8px',
        background: theme.bgSecondary,
        borderRadius: theme.radius,
        fontFamily: theme.fontSans,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Globe size={10} color={accentColor} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: '0.95em', color: theme.textPrimary, fontWeight: 600, flex: 1 }}>
            {data.name}
          </span>
          {data.url && (
            <a href={data.url} target="_blank" rel="noopener noreferrer" style={{ color: theme.textMuted }}>
              <ExternalLink size={10} />
            </a>
          )}
        </div>
        {data.description && (
          <div style={{ fontSize: '0.85em', color: theme.textSecondary, marginTop: 2, lineHeight: 1.4 }}>
            {data.description}
          </div>
        )}
      </div>
    )
  }

  // detail === 'full'
  return (
    <div style={{
      borderLeft: `3px solid ${accentColor}`,
      padding: '10px 12px',
      background: theme.bgSecondary,
      borderRadius: theme.radius,
      fontFamily: theme.fontSans,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <Globe size={14} color={accentColor} style={{ flexShrink: 0 }} />
        <span style={{ fontSize: '1em', color: theme.textPrimary, fontWeight: 600, flex: 1 }}>
          {data.name}
        </span>
        {data.url && (
          <a href={data.url} target="_blank" rel="noopener noreferrer"
            style={{ fontSize: '0.8em', color: theme.accent, textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 3 }}>
            {data.url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
            <ExternalLink size={10} />
          </a>
        )}
      </div>

      {/* Description */}
      {data.description && (
        <div style={{ fontSize: '0.9em', color: theme.textSecondary, marginBottom: 8, lineHeight: 1.5 }}>
          {data.description}
        </div>
      )}

      {/* Market position */}
      {data.marketPosition && (
        <div style={{
          fontSize: '0.8em', padding: '3px 8px', borderRadius: 12,
          background: `${accentColor}15`, color: accentColor, display: 'inline-block', marginBottom: 8,
        }}>
          {data.marketPosition}
        </div>
      )}

      {/* Color swatches */}
      {data.extractedColors && data.extractedColors.length > 0 && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 8, alignItems: 'center' }}>
          <span style={{ fontSize: '0.75em', color: theme.textMuted, marginRight: 4 }}>Colors:</span>
          {data.extractedColors.map((color, i) => (
            <div key={i} style={{
              width: 16, height: 16, borderRadius: '50%',
              background: color.startsWith('#') ? color : `#${color}`,
              border: `1px solid ${theme.borderSecondary}`,
            }} title={color} />
          ))}
        </div>
      )}

      {/* Fonts */}
      {data.extractedFonts && data.extractedFonts.length > 0 && (
        <div style={{ display: 'flex', gap: 4, marginBottom: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.75em', color: theme.textMuted, marginRight: 4 }}>Fonts:</span>
          {data.extractedFonts.map((font, i) => (
            <span key={i} style={{
              fontSize: '0.8em', padding: '1px 6px', borderRadius: 4,
              background: theme.bgTertiary, color: theme.textSecondary, fontFamily: font,
            }}>
              {font}
            </span>
          ))}
        </div>
      )}

      {/* Strengths / Weaknesses */}
      <div style={{ display: 'flex', gap: 12 }}>
        {data.strengths && data.strengths.length > 0 && (
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
              <ThumbsUp size={10} color={theme.success} />
              <span style={{ fontSize: '0.75em', fontWeight: 600, color: theme.success }}>Strengths</span>
            </div>
            {data.strengths.map((s, i) => (
              <div key={i} style={{ fontSize: '0.8em', color: theme.textSecondary, lineHeight: 1.5 }}>
                • {s}
              </div>
            ))}
          </div>
        )}
        {data.weaknesses && data.weaknesses.length > 0 && (
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
              <ThumbsDown size={10} color={theme.error} />
              <span style={{ fontSize: '0.75em', fontWeight: 600, color: theme.error }}>Weaknesses</span>
            </div>
            {data.weaknesses.map((w, i) => (
              <div key={i} style={{ fontSize: '0.8em', color: theme.textSecondary, lineHeight: 1.5 }}>
                • {w}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
})
