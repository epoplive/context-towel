import { memo, useState } from 'react'
import { Code2, Copy, Check, Sun, Moon } from 'lucide-react'
import type { BlockRenderProps } from '../../blocks/types'
import type { ComponentBlockData } from './types'

const CATEGORY_COLORS: Record<string, string> = {
  buttons: '#4F46E5',
  cards: '#0EA5E9',
  badges: '#F59E0B',
  forms: '#10B981',
  navigation: '#8B5CF6',
  panels: '#EC4899',
  data: '#14B8A6',
  feedback: '#F97316',
  icons: '#6B7280',
}

export const ComponentCard = memo(function ComponentCard({
  data,
  detail,
  theme,
}: BlockRenderProps<ComponentBlockData>) {
  const [showCode, setShowCode] = useState(false)
  const [darkPreview, setDarkPreview] = useState(false)
  const [copied, setCopied] = useState(false)

  const catColor = CATEGORY_COLORS[data.category ?? ''] ?? '#6366f1'

  if (detail === 'mini') {
    return (
      <div style={{
        borderLeft: `3px solid ${catColor}`,
        padding: '4px 8px',
        background: theme.bgSecondary,
        borderRadius: theme.radius,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: theme.fontSans,
      }}>
        <Code2 size={10} color={catColor} style={{ flexShrink: 0 }} />
        <span style={{ fontSize: '0.95em', color: theme.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {data.name}
        </span>
      </div>
    )
  }

  if (detail === 'summary') {
    return (
      <div style={{
        borderLeft: `3px solid ${catColor}`,
        padding: '6px 8px',
        background: theme.bgSecondary,
        borderRadius: theme.radius,
        fontFamily: theme.fontSans,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Code2 size={10} color={catColor} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: '0.95em', color: theme.textPrimary, fontWeight: 600, flex: 1 }}>
            {data.name}
          </span>
          {data.category && (
            <span style={{
              fontSize: '0.7em', fontWeight: 700, textTransform: 'uppercase',
              padding: '1px 5px', borderRadius: 3, background: `${catColor}22`, color: catColor,
            }}>
              {data.category}
            </span>
          )}
        </div>
      </div>
    )
  }

  // detail === 'full'
  const handleCopy = () => {
    if (data.code) {
      navigator.clipboard.writeText(data.code).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
    }
  }

  return (
    <div style={{
      borderLeft: `3px solid ${catColor}`,
      background: theme.bgSecondary,
      borderRadius: theme.radius,
      fontFamily: theme.fontSans,
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <Code2 size={14} color={catColor} style={{ flexShrink: 0 }} />
        <span style={{ fontSize: '1em', color: theme.textPrimary, fontWeight: 600, flex: 1 }}>
          {data.name}
        </span>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {data.category && (
            <span style={{
              fontSize: '0.7em', fontWeight: 700, textTransform: 'uppercase',
              padding: '1px 5px', borderRadius: 3, background: `${catColor}22`, color: catColor,
            }}>
              {data.category}
            </span>
          )}
          {data.variants && data.variants.map((v, i) => (
            <span key={i} style={{
              fontSize: '0.7em', padding: '1px 5px', borderRadius: 3,
              background: theme.bgTertiary, color: theme.textMuted,
            }}>
              {v}
            </span>
          ))}
        </div>
      </div>

      {/* Usage */}
      {data.usage && (
        <div style={{ padding: '0 12px 8px', fontSize: '0.85em', color: theme.textSecondary, lineHeight: 1.4 }}>
          {data.usage}
        </div>
      )}

      {/* Preview */}
      {data.preview && (
        <div style={{
          margin: '0 12px',
          borderRadius: 8,
          border: `1px solid ${theme.borderSecondary}`,
          overflow: 'hidden',
        }}>
          {/* Preview toolbar */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '4px 8px',
            background: theme.bgTertiary,
            borderBottom: `1px solid ${theme.borderSecondary}`,
          }}>
            <span style={{ fontSize: '0.7em', color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Preview
            </span>
            {data.darkMode && (
              <button
                onClick={() => setDarkPreview(!darkPreview)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  fontSize: '0.7em', color: theme.textMuted,
                  background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px',
                }}
              >
                {darkPreview ? <Moon size={10} /> : <Sun size={10} />}
                {darkPreview ? 'Dark' : 'Light'}
              </button>
            )}
          </div>

          {/* Rendered preview */}
          <div
            style={{
              padding: 16,
              background: darkPreview ? '#111827' : '#ffffff',
              minHeight: 48,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            dangerouslySetInnerHTML={{ __html: data.preview }}
          />
        </div>
      )}

      {/* Code toggle + block */}
      {data.code && (
        <div style={{ margin: '8px 12px 12px' }}>
          <div style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
            <button
              onClick={() => setShowCode(!showCode)}
              style={{
                fontSize: '0.75em', color: theme.textMuted, background: 'none',
                border: 'none', cursor: 'pointer', padding: '2px 0',
                textDecoration: 'underline',
              }}
            >
              {showCode ? 'Hide code' : 'Show code'}
            </button>
            <button
              onClick={handleCopy}
              style={{
                fontSize: '0.75em', color: theme.textMuted, background: 'none',
                border: 'none', cursor: 'pointer', padding: '2px 0',
                display: 'flex', alignItems: 'center', gap: 3,
              }}
            >
              {copied ? <Check size={10} color={theme.success} /> : <Copy size={10} />}
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>

          {showCode && (
            <pre style={{
              fontSize: '0.8em',
              fontFamily: theme.fontMono,
              background: theme.bgTertiary,
              padding: 10,
              borderRadius: 6,
              overflow: 'auto',
              color: theme.textSecondary,
              lineHeight: 1.5,
              whiteSpace: 'pre-wrap',
            }}>
              {data.code}
            </pre>
          )}
        </div>
      )}

      {/* Props */}
      {data.props && data.props.length > 0 && (
        <div style={{ padding: '0 12px 10px', display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {data.props.map((prop, i) => (
            <span key={i} style={{
              fontSize: '0.7em', padding: '1px 6px', borderRadius: 4,
              background: theme.bgTertiary, color: theme.textMuted, fontFamily: theme.fontMono,
            }}>
              {prop}
            </span>
          ))}
        </div>
      )}
    </div>
  )
})
