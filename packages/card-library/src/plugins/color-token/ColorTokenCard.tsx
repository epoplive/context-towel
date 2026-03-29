import { memo, useRef, useState, useEffect } from 'react'
import type { BlockRenderProps } from '../../blocks/types'
import type { ColorTokenBlockData } from './types'

function contrastColor(hex: string): string {
  const h = hex.replace('#', '')
  if (h.length < 6) return '#000000'
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return lum > 0.5 ? '#000000' : '#ffffff'
}

function relativeLuminance(hex: string): number {
  const h = hex.replace('#', '')
  if (h.length < 6) return 0
  const toLinear = (c: number) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * toLinear(parseInt(h.substring(0, 2), 16))
       + 0.7152 * toLinear(parseInt(h.substring(2, 4), 16))
       + 0.0722 * toLinear(parseInt(h.substring(4, 6), 16))
}

function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(fg)
  const l2 = relativeLuminance(bg)
  const lighter = Math.max(l1, l2)
  const darker = Math.min(l1, l2)
  return (lighter + 0.05) / (darker + 0.05)
}

function wcagLevel(ratio: number): string {
  if (ratio >= 7) return 'AAA'
  if (ratio >= 4.5) return 'AA'
  if (ratio >= 3) return 'AA-large'
  return 'fail'
}

export const ColorTokenCard = memo(function ColorTokenCard({
  data,
  detail,
  theme,
  onEdit,
}: BlockRenderProps<ColorTokenBlockData>) {
  const lightRef = useRef<HTMLInputElement>(null)
  const darkRef = useRef<HTMLInputElement>(null)
  const [lightValue, setLightValue] = useState(data.value)
  const [darkValue, setDarkValue] = useState(data.darkValue ?? '')

  useEffect(() => {
    setLightValue(data.value)
    setDarkValue(data.darkValue ?? '')
  }, [data.value, data.darkValue])

  const handleLightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setLightValue(e.target.value)
  }
  const handleLightCommit = () => {
    if (lightValue !== data.value && onEdit) {
      onEdit({ blockType: 'color-token', field: 'value', value: lightValue, blockId: data.name })
    }
  }
  const handleDarkChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setDarkValue(e.target.value)
  }
  const handleDarkCommit = () => {
    if (darkValue !== (data.darkValue ?? '') && onEdit) {
      onEdit({ blockType: 'color-token', field: 'darkValue', value: darkValue, blockId: data.name })
    }
  }

  // Auto-calculate contrast against white background
  const autoRatio = contrastRatio(lightValue, '#ffffff')
  const autoWcag = wcagLevel(autoRatio)
  const displayRatio = data.contrastRatio ?? `${autoRatio.toFixed(1)}:1`
  const displayWcag = data.wcag ?? autoWcag

  const swatchSize = detail === 'mini' ? 14 : detail === 'summary' ? 20 : 36

  if (detail === 'mini') {
    return (
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        padding: '2px 6px', background: theme.bgSecondary,
        borderRadius: theme.radius, fontFamily: theme.fontSans,
      }}>
        <div style={{
          width: swatchSize, height: swatchSize, borderRadius: 4,
          background: lightValue, border: `1px solid ${theme.borderSecondary}`,
        }} />
        <span style={{ fontSize: '0.85em', color: theme.textPrimary }}>{data.name}</span>
      </div>
    )
  }

  if (detail === 'summary') {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '4px 8px', background: theme.bgSecondary,
        borderRadius: theme.radius, fontFamily: theme.fontSans,
      }}>
        <div style={{
          width: swatchSize, height: swatchSize, borderRadius: 6,
          background: lightValue, border: `1px solid ${theme.borderSecondary}`,
        }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.9em', fontWeight: 600, color: theme.textPrimary }}>{data.name}</div>
          <div style={{ fontSize: '0.75em', color: theme.textMuted, fontFamily: theme.fontMono }}>{lightValue}</div>
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
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '8px 12px', background: theme.bgSecondary,
      borderRadius: theme.radius, fontFamily: theme.fontSans,
    }}>
      {/* Light mode swatch with color picker */}
      <div style={{ textAlign: 'center', position: 'relative' }}>
        <div
          onClick={() => lightRef.current?.click()}
          style={{
            width: swatchSize, height: swatchSize, borderRadius: 8,
            background: lightValue, border: `1px solid ${theme.borderSecondary}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: onEdit ? 'pointer' : 'default',
            transition: 'box-shadow 0.15s',
          }}
          title={onEdit ? `Click to edit ${data.name}` : data.name}
        >
          <span style={{
            fontSize: '0.5em', fontWeight: 700, fontFamily: theme.fontMono,
            color: contrastColor(lightValue),
          }}>
            {lightValue}
          </span>
        </div>
        {onEdit && (
          <input
            ref={lightRef}
            type="color"
            value={lightValue}
            onChange={handleLightChange}
            onBlur={handleLightCommit}
            style={{
              position: 'absolute', top: 0, left: 0, width: 1, height: 1,
              opacity: 0, overflow: 'hidden', pointerEvents: 'none',
            }}
            aria-label={`Pick color for ${data.name}`}
          />
        )}
        <div style={{ fontSize: '0.6em', color: theme.textMuted, marginTop: 2 }}>light</div>
      </div>

      {/* Dark mode swatch with color picker */}
      {(darkValue || data.darkValue) && (
        <div style={{ textAlign: 'center', position: 'relative' }}>
          <div
            onClick={() => darkRef.current?.click()}
            style={{
              width: swatchSize, height: swatchSize, borderRadius: 8,
              background: darkValue || '#000',
              border: `1px solid ${theme.borderSecondary}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: onEdit ? 'pointer' : 'default',
            }}
            title={onEdit ? `Click to edit dark ${data.name}` : `dark ${data.name}`}
          >
            <span style={{
              fontSize: '0.5em', fontWeight: 700, fontFamily: theme.fontMono,
              color: contrastColor(darkValue || '#000'),
            }}>
              {darkValue}
            </span>
          </div>
          {onEdit && (
            <input
              ref={darkRef}
              type="color"
              value={darkValue || '#000000'}
              onChange={handleDarkChange}
              onBlur={handleDarkCommit}
              style={{
                position: 'absolute', top: 0, left: 0, width: 1, height: 1,
                opacity: 0, overflow: 'hidden', pointerEvents: 'none',
              }}
              aria-label={`Pick dark color for ${data.name}`}
            />
          )}
          <div style={{ fontSize: '0.6em', color: theme.textMuted, marginTop: 2 }}>dark</div>
        </div>
      )}

      {/* Name + metadata */}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: '0.95em', fontWeight: 600, color: theme.textPrimary }}>{data.name}</div>
        <div style={{ display: 'flex', gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
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
          <span style={{
            fontSize: '0.7em', padding: '1px 5px', borderRadius: 3,
            background: displayWcag === 'fail' ? `${theme.error}15` : `${theme.success}15`,
            color: displayWcag === 'fail' ? theme.error : theme.success,
          }}>
            WCAG {displayWcag}
          </span>
          <span style={{
            fontSize: '0.7em', padding: '1px 5px', borderRadius: 3,
            background: theme.bgTertiary, color: theme.textMuted,
          }}>
            {displayRatio}
          </span>
        </div>
        {data.rationale && (
          <div style={{ fontSize: '0.8em', color: theme.textSecondary, marginTop: 4, lineHeight: 1.4 }}>
            {data.rationale}
          </div>
        )}
      </div>
    </div>
  )
})
