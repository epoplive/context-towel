import { memo } from 'react'
import { FileText } from 'lucide-react'
import type { BlockRenderProps } from '../../blocks/types'
import type { SitePageBlockData } from './types'

const TYPE_COLORS: Record<string, string> = {
  dashboard: '#3b82f6',
  form: '#8b5cf6',
  detail: '#14b8a6',
  custom: '#f97316',
  gallery: '#ec4899',
  settings: '#6b7280',
}

const PRIORITY_COLORS: Record<string, string> = {
  'must-have': '#ef4444',
  'should-have': '#f59e0b',
  'nice-to-have': '#6b7280',
}

export const SitePageCard = memo(function SitePageCard({
  data,
  detail,
  theme,
}: BlockRenderProps<SitePageBlockData>) {
  const typeColor = TYPE_COLORS[data.pageType ?? ''] ?? '#6366f1'

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
        <FileText size={10} color={typeColor} style={{ flexShrink: 0 }} />
        <span style={{ fontSize: '0.95em', color: theme.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {data.title}
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
          <FileText size={10} color={typeColor} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: '0.95em', color: theme.textPrimary, fontWeight: 600, flex: 1 }}>
            {data.title}
          </span>
          {data.pageType && (
            <span style={{
              fontSize: '0.7em', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px',
              padding: '1px 5px', borderRadius: 3, background: `${typeColor}22`, color: typeColor,
            }}>
              {data.pageType}
            </span>
          )}
        </div>
        {data.slug && (
          <div style={{ fontSize: '0.8em', color: theme.textMuted, marginTop: 2 }}>
            /{data.slug}
          </div>
        )}
      </div>
    )
  }

  // detail === 'full'
  const priorityColor = PRIORITY_COLORS[data.priority ?? ''] ?? '#6b7280'

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
        <FileText size={14} color={typeColor} style={{ flexShrink: 0 }} />
        <span style={{ fontSize: '1em', color: theme.textPrimary, fontWeight: 600, flex: 1 }}>
          {data.title}
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          {data.pageType && (
            <span style={{
              fontSize: '0.7em', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px',
              padding: '1px 5px', borderRadius: 3, background: `${typeColor}22`, color: typeColor,
            }}>
              {data.pageType}
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

      {/* Slug */}
      {data.slug && (
        <div style={{ fontSize: '0.8em', color: theme.textMuted, marginBottom: 4, fontFamily: theme.fontMono }}>
          /{data.slug}
        </div>
      )}

      {/* Description */}
      {data.description && (
        <div style={{ fontSize: '0.9em', color: theme.textSecondary, marginBottom: 6, lineHeight: 1.5 }}>
          {data.description}
        </div>
      )}

      {/* Sections */}
      {data.sections && data.sections.length > 0 && (
        <div style={{ marginBottom: 4 }}>
          <div style={{ fontSize: '0.7em', fontWeight: 600, color: theme.textMuted, marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sections</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {data.sections.map((section, i) => (
              <span key={i} style={{
                fontSize: '0.75em', padding: '2px 6px', borderRadius: 4,
                background: theme.bgTertiary, color: theme.textSecondary,
              }}>
                {section}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Features */}
      {data.features && data.features.length > 0 && (
        <div style={{ marginBottom: 4 }}>
          <div style={{ fontSize: '0.7em', fontWeight: 600, color: theme.textMuted, marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Features</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {data.features.map((feature, i) => (
              <span key={i} style={{
                fontSize: '0.75em', padding: '2px 6px', borderRadius: 4,
                background: `${typeColor}10`, color: typeColor, border: `1px solid ${typeColor}30`,
              }}>
                {feature}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Data Requirements */}
      {data.dataRequirements && data.dataRequirements.length > 0 && (
        <div>
          <div style={{ fontSize: '0.7em', fontWeight: 600, color: theme.textMuted, marginBottom: 2, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Data</div>
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {data.dataRequirements.map((req, i) => (
              <span key={i} style={{
                fontSize: '0.7em', padding: '2px 6px', borderRadius: 4,
                background: theme.bgTertiary, color: theme.textMuted, fontFamily: theme.fontMono,
              }}>
                {req}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
})
