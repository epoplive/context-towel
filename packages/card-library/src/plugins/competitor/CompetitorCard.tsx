import { memo, useState } from 'react'
import { Globe, ExternalLink, ThumbsUp, ThumbsDown, ChevronDown, ChevronUp } from 'lucide-react'
import type { BlockRenderProps } from '../../blocks/types'
import type { CompetitorBlockData } from './types'

export const CompetitorCard = memo(function CompetitorCard({
  data,
  detail,
  theme,
}: BlockRenderProps<CompetitorBlockData>) {
  const [expanded, setExpanded] = useState(detail === 'full')
  const accentColor = '#6366f1'

  if (detail === 'mini') {
    return (
      <div style={{
        borderLeft: `3px solid ${accentColor}`,
        padding: '4px 8px', background: theme.bgSecondary,
        borderRadius: theme.radius, display: 'flex', alignItems: 'center', gap: 6,
        fontFamily: theme.fontSans,
      }}>
        <Globe size={10} color={accentColor} style={{ flexShrink: 0 }} />
        <span style={{ fontSize: '0.95em', color: theme.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {data.name}
        </span>
      </div>
    )
  }

  // summary + full both use the same layout, just expanded or not
  return (
    <div style={{
      borderLeft: `3px solid ${accentColor}`,
      padding: '10px 12px', background: theme.bgSecondary,
      borderRadius: theme.radius, fontFamily: theme.fontSans,
    }}>
      {/* Header — always visible */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
        onClick={() => setExpanded(!expanded)}
      >
        <Globe size={14} color={accentColor} style={{ flexShrink: 0 }} />
        <span style={{ fontSize: '1em', color: theme.textPrimary, fontWeight: 600, flex: 1 }}>
          {data.name}
        </span>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {data.marketPosition && (
            <span style={{
              fontSize: '0.7em', fontWeight: 700, textTransform: 'uppercase',
              padding: '1px 5px', borderRadius: 3, background: `${accentColor}15`, color: accentColor,
            }}>{data.marketPosition}</span>
          )}
          {data.pricing && (
            <span style={{
              fontSize: '0.7em', padding: '1px 5px', borderRadius: 3,
              background: theme.bgTertiary, color: theme.textMuted,
            }}>{data.pricing}</span>
          )}
          {data.url && (
            <a href={data.url} target="_blank" rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              style={{ color: theme.accent, display: 'flex', alignItems: 'center' }}>
              <ExternalLink size={10} />
            </a>
          )}
          {expanded ? <ChevronUp size={12} color={theme.textMuted} /> : <ChevronDown size={12} color={theme.textMuted} />}
        </div>
      </div>

      {/* Screenshot — always visible if available */}
      {data.screenshotPath && (
        <div style={{ marginTop: 6, borderRadius: 8, overflow: 'hidden', border: `1px solid ${theme.borderSecondary}` }}>
          <img
            src={data.screenshotPath.startsWith('http') ? data.screenshotPath : `/api/workflow/${data.screenshotPath}`}
            alt={`${data.name} screenshot`}
            style={{ width: '100%', height: 'auto', display: 'block', maxHeight: 200, objectFit: 'cover', objectPosition: 'top' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        </div>
      )}

      {/* Description — always visible */}
      {data.description && (
        <div style={{ fontSize: '0.85em', color: theme.textSecondary, marginTop: 4, lineHeight: 1.4 }}>
          {data.description}
        </div>
      )}

      {/* Color swatches — always visible */}
      {data.extractedColors && data.extractedColors.length > 0 && (
        <div style={{ display: 'flex', gap: 4, marginTop: 6, alignItems: 'center' }}>
          {data.extractedColors.map((color, i) => (
            <div key={i} title={color} style={{
              width: 16, height: 16, borderRadius: '50%',
              background: color.startsWith('#') ? color : `#${color}`,
              border: `1px solid ${theme.borderSecondary}`,
            }} />
          ))}
          {data.extractedFonts && data.extractedFonts.length > 0 && (
            <>
              <span style={{ fontSize: '0.7em', color: theme.textMuted, marginLeft: 8 }}>|</span>
              {data.extractedFonts.map((font, i) => (
                <span key={i} style={{
                  fontSize: '0.75em', padding: '1px 5px', borderRadius: 3,
                  background: theme.bgTertiary, color: theme.textMuted, fontFamily: font,
                }}>{font}</span>
              ))}
            </>
          )}
        </div>
      )}

      {/* Expanded content */}
      {expanded && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${theme.borderSecondary}` }}>
          {/* Target audience */}
          {data.targetAudience && (
            <div style={{ fontSize: '0.8em', color: theme.textMuted, marginBottom: 6 }}>
              <strong>Audience:</strong> {data.targetAudience}
            </div>
          )}

          {/* Core features */}
          {data.coreFeatures && data.coreFeatures.length > 0 && (
            <div style={{ display: 'flex', gap: 4, marginBottom: 8, flexWrap: 'wrap' }}>
              {data.coreFeatures.map((feature, i) => (
                <span key={i} style={{
                  fontSize: '0.7em', padding: '1px 6px', borderRadius: 4,
                  background: `${accentColor}10`, color: accentColor, border: `1px solid ${accentColor}30`,
                }}>{feature}</span>
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
                  <div key={i} style={{ fontSize: '0.8em', color: theme.textSecondary, lineHeight: 1.5 }}>• {s}</div>
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
                  <div key={i} style={{ fontSize: '0.8em', color: theme.textSecondary, lineHeight: 1.5 }}>• {w}</div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
})
