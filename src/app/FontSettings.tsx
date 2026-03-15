import { useState, useEffect, useCallback } from 'react'
import { RotateCcw, Type, ChevronDown, Eye, SlidersHorizontal, Paintbrush } from 'lucide-react'
import { useTypographyStore } from './typography-store'
import { MONO_FONTS, SANS_FONTS, loadFont, type FontConfig } from './fonts'
import { useTheme } from '@context-towel/context-graph/compat/design-system'

// Build font presets from the font configs
const UI_FONT_PRESETS = [
  { id: 'default', name: 'Default (system)', value: '', fontConfig: null as FontConfig | null, description: 'Native system font for each OS' },
  ...SANS_FONTS.map(f => ({ id: f.id, name: f.name, value: f.cssValue, fontConfig: f as FontConfig | null, description: f.description || '' })),
  { id: 'custom', name: 'Custom...', value: '', fontConfig: null as FontConfig | null, description: 'Enter a custom font stack' },
]

const MONO_FONT_PRESETS = [
  { id: 'default', name: 'Default monospace', value: '', fontConfig: null as FontConfig | null, description: 'Native system monospace font' },
  ...MONO_FONTS.map(f => ({ id: f.id, name: f.name, value: f.cssValue, fontConfig: f as FontConfig | null, description: f.description || '' })),
  { id: 'custom', name: 'Custom...', value: '', fontConfig: null as FontConfig | null, description: 'Enter a custom font stack' },
]

type FontPreset = typeof UI_FONT_PRESETS[number]

const FONT_SMOOTHING_OPTIONS = [
  { id: 'auto', name: 'Auto', description: 'Browser default' },
  { id: 'antialiased', name: 'Antialiased', description: 'Grayscale smoothing (thinner)' },
  { id: 'subpixel', name: 'Subpixel', description: 'Subpixel smoothing (bolder)' },
] as const

const TEXT_RENDERING_OPTIONS = [
  { id: 'auto', name: 'Auto', description: 'Browser default' },
  { id: 'optimizeSpeed', name: 'Speed', description: 'Faster, may reduce quality' },
  { id: 'optimizeLegibility', name: 'Legibility', description: 'Better kerning/ligatures' },
  { id: 'geometricPrecision', name: 'Precision', description: 'Precise scaling' },
] as const

const resolvePresetId = (value: string, options: FontPreset[]) => {
  if (!value) return 'default'
  const match = options.find((opt) => opt.value === value)
  return match ? match.id : 'custom'
}

// Load a font when selected
async function handleFontSelect(preset: FontPreset): Promise<void> {
  if (preset.fontConfig && preset.fontConfig.googleFontFamily) {
    try {
      await loadFont(preset.fontConfig)
    } catch (e) {
      console.warn('Failed to load font:', preset.name, e)
    }
  }
}

// Sample text for font preview
const PREVIEW_TEXT = 'The quick brown fox jumps over the lazy dog. 0123456789 AaBbCcDdEeFfGg'
const MONO_PREVIEW_TEXT = 'const hello = "world"; // 0O 1lI {[()]} => != <>'

interface SliderControlProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit: string
  onChange: (value: number) => void
  defaultValue: number
}

function SliderControl({ label, value, min, max, step, unit, onChange, defaultValue }: SliderControlProps) {
  const { colors } = useTheme()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <label style={{
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: colors.textMuted,
          fontWeight: 600,
        }}>{label}</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: colors.textPrimary, fontVariantNumeric: 'tabular-nums' }}>
            {value.toFixed(step < 1 ? 2 : 0)}{unit}
          </span>
          {value !== defaultValue && (
            <button
              onClick={() => onChange(defaultValue)}
              title="Reset to default"
              style={{
                background: 'transparent',
                border: 'none',
                padding: '2px',
                cursor: 'pointer',
                color: colors.textMuted,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <RotateCcw size={12} />
            </button>
          )}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        style={{ width: '100%', height: 4, borderRadius: 2, cursor: 'pointer', accentColor: colors.accent }}
      />
    </div>
  )
}

interface FontSelectorProps {
  label: string
  options: FontPreset[]
  value: string
  onChange: (preset: FontPreset) => void
  onHover: (preset: FontPreset | null) => void
  hoveredPreset: FontPreset | null
  customValue: string
  onCustomChange: (value: string) => void
}

function FontSelector({ label, options, value, onChange, onHover, hoveredPreset, customValue, onCustomChange }: FontSelectorProps) {
  const { colors } = useTheme()
  const [isOpen, setIsOpen] = useState(false)
  const currentPreset = options.find(o => o.id === value) ?? options[0]
  const displayPreset = hoveredPreset ?? currentPreset

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label style={{
        fontSize: 10,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: colors.textMuted,
        fontWeight: 600,
      }}>{label}</label>

      {/* Current/Preview info */}
      <div style={{
        padding: '8px 12px',
        background: colors.bgPrimary,
        border: `1px solid ${colors.borderPrimary}`,
        borderRadius: 6,
        height: 52,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        boxSizing: 'border-box',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 14, fontWeight: 500, color: colors.textPrimary }}>{displayPreset?.name ?? 'Unknown'}</span>
          {displayPreset?.fontConfig?.hasLigatures && (
            <span style={{
              fontSize: 10,
              color: colors.accent,
              background: `${colors.accent}1a`,
              padding: '2px 6px',
              borderRadius: 4,
            }}>ligatures</span>
          )}
        </div>
        <div style={{ fontSize: 12, color: colors.textMuted }}>{displayPreset?.description ?? ''}</div>
      </div>

      {/* Dropdown trigger */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            background: colors.bgPrimary,
            border: `1px solid ${colors.borderPrimary}`,
            borderRadius: 6,
            fontSize: 12,
            color: colors.textPrimary,
            cursor: 'pointer',
            boxSizing: 'border-box',
          }}
        >
          <span>{currentPreset?.name ?? 'Select font'}</span>
          <ChevronDown size={14} style={{ transform: isOpen ? 'rotate(180deg)' : undefined, transition: 'transform 0.15s' }} />
        </button>

        {isOpen && (
          <div style={{
            position: 'absolute',
            zIndex: 50,
            top: '100%',
            left: 0,
            right: 0,
            marginTop: 4,
            background: colors.bgSecondary,
            border: `1px solid ${colors.borderPrimary}`,
            borderRadius: 8,
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            maxHeight: 300,
            overflowY: 'auto',
          }}>
            {options.map((option) => (
              <button
                key={option.id}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 12px',
                  fontSize: 12,
                  background: option.id === value ? colors.bgTertiary : 'transparent',
                  color: option.id === value ? colors.textPrimary : colors.textSecondary,
                  border: 'none',
                  cursor: 'pointer',
                  display: 'block',
                  fontFamily: option.value || undefined,
                }}
                onMouseEnter={() => onHover(option)}
                onMouseLeave={() => onHover(null)}
                onClick={() => {
                  onChange(option)
                  setIsOpen(false)
                  onHover(null)
                }}
              >
                <div style={{ fontWeight: 500 }}>{option.name}</div>
                {option.id !== 'default' && option.id !== 'custom' && (
                  <div style={{ fontSize: 11, color: colors.textMuted, marginTop: 2, opacity: 0.7 }}>{option.description}</div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Custom input */}
      {value === 'custom' && (
        <input
          type="text"
          value={customValue}
          onChange={(e) => onCustomChange(e.target.value)}
          placeholder="e.g., 'Roboto', Arial, sans-serif"
          style={{
            padding: '6px 10px',
            borderRadius: 6,
            border: `1px solid ${colors.borderPrimary}`,
            background: colors.bgPrimary,
            color: colors.textPrimary,
            fontSize: 12,
            outline: 'none',
          }}
        />
      )}
    </div>
  )
}

interface SegmentedControlProps<T extends string> {
  label: string
  options: readonly { id: T; name: string; description: string }[]
  value: T
  onChange: (value: T) => void
}

function SegmentedControl<T extends string>({ label, options, value, onChange }: SegmentedControlProps<T>) {
  const { colors } = useTheme()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <label style={{
        fontSize: 10,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        color: colors.textMuted,
        fontWeight: 600,
      }}>{label}</label>
      <div style={{
        display: 'flex',
        background: colors.bgTertiary,
        borderRadius: 8,
        padding: 2,
      }}>
        {options.map((option) => (
          <button
            key={option.id}
            onClick={() => onChange(option.id)}
            title={option.description}
            style={{
              flex: 1,
              padding: '6px 12px',
              fontSize: 12,
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              transition: 'background 0.15s, color 0.15s',
              background: value === option.id ? colors.bgPrimary : 'transparent',
              color: value === option.id ? colors.textPrimary : colors.textMuted,
              boxShadow: value === option.id ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
            }}
          >
            {option.name}
          </button>
        ))}
      </div>
    </div>
  )
}

export function FontSettings() {
  const { colors } = useTheme()

  // Typography store
  const primaryFont = useTypographyStore((state) => state.primaryFont)
  const monoFont = useTypographyStore((state) => state.monoFont)
  const fontSize = useTypographyStore((state) => state.fontSize)
  const lineHeight = useTypographyStore((state) => state.lineHeight)
  const monoLineHeight = useTypographyStore((state) => state.monoLineHeight)
  const letterSpacing = useTypographyStore((state) => state.letterSpacing)
  const fontSmoothing = useTypographyStore((state) => state.fontSmoothing)
  const textRendering = useTypographyStore((state) => state.textRendering)
  const fontWeight = useTypographyStore((state) => state.fontWeight)
  const setPrimaryFont = useTypographyStore((state) => state.setPrimaryFont)
  const setMonoFont = useTypographyStore((state) => state.setMonoFont)
  const setFontSize = useTypographyStore((state) => state.setFontSize)
  const setLineHeight = useTypographyStore((state) => state.setLineHeight)
  const setMonoLineHeight = useTypographyStore((state) => state.setMonoLineHeight)
  const setLetterSpacing = useTypographyStore((state) => state.setLetterSpacing)
  const setFontSmoothing = useTypographyStore((state) => state.setFontSmoothing)
  const setTextRendering = useTypographyStore((state) => state.setTextRendering)
  const setFontWeight = useTypographyStore((state) => state.setFontWeight)

  // Local state for preset selection
  const [primaryPreset, setPrimaryPreset] = useState(() => resolvePresetId(primaryFont, UI_FONT_PRESETS))
  const [monoPreset, setMonoPreset] = useState(() => resolvePresetId(monoFont, MONO_FONT_PRESETS))
  const [primaryCustomFont, setPrimaryCustomFont] = useState(
    resolvePresetId(primaryFont, UI_FONT_PRESETS) === 'custom' ? primaryFont : '',
  )
  const [monoCustomFont, setMonoCustomFont] = useState(
    resolvePresetId(monoFont, MONO_FONT_PRESETS) === 'custom' ? monoFont : '',
  )

  // Preview font state (for hover preview)
  const [hoveredPrimaryPreset, setHoveredPrimaryPreset] = useState<FontPreset | null>(null)
  const [hoveredMonoPreset, setHoveredMonoPreset] = useState<FontPreset | null>(null)

  // Sync preset selection with store values
  useEffect(() => {
    const nextPreset = resolvePresetId(primaryFont, UI_FONT_PRESETS)
    setPrimaryPreset(nextPreset)
    if (nextPreset === 'custom') {
      setPrimaryCustomFont(primaryFont)
    }
  }, [primaryFont])

  useEffect(() => {
    const nextPreset = resolvePresetId(monoFont, MONO_FONT_PRESETS)
    setMonoPreset(nextPreset)
    if (nextPreset === 'custom') {
      setMonoCustomFont(monoFont)
    }
  }, [monoFont])

  // Handle font hover for preview
  const handlePrimaryFontHover = useCallback(async (preset: FontPreset | null) => {
    if (preset?.fontConfig?.googleFontFamily) {
      try {
        await loadFont(preset.fontConfig)
      } catch {
        // Ignore load errors for hover preview
      }
    }
    setHoveredPrimaryPreset(preset)
  }, [])

  const handleMonoFontHover = useCallback(async (preset: FontPreset | null) => {
    if (preset?.fontConfig?.googleFontFamily) {
      try {
        await loadFont(preset.fontConfig)
      } catch {
        // Ignore load errors for hover preview
      }
    }
    setHoveredMonoPreset(preset)
  }, [])

  const handlePrimaryFontChange = useCallback(async (preset: FontPreset) => {
    setPrimaryPreset(preset.id)
    if (preset.id === 'custom') {
      setPrimaryFont(primaryCustomFont.trim())
      return
    }
    await handleFontSelect(preset)
    setPrimaryFont(preset.value)
  }, [primaryCustomFont, setPrimaryFont])

  const handleMonoFontChange = useCallback(async (preset: FontPreset) => {
    setMonoPreset(preset.id)
    if (preset.id === 'custom') {
      setMonoFont(monoCustomFont.trim())
      return
    }
    await handleFontSelect(preset)
    setMonoFont(preset.value)
  }, [monoCustomFont, setMonoFont])

  const handleReset = () => {
    setPrimaryFont('')
    setMonoFont('')
    setFontSize(14)
    setLineHeight(1.5)
    setMonoLineHeight(1.0)
    setLetterSpacing(0)
    setFontSmoothing('antialiased')
    setTextRendering('optimizeLegibility')
    setFontWeight(400)
    setPrimaryPreset('default')
    setMonoPreset('default')
    setPrimaryCustomFont('')
    setMonoCustomFont('')
  }

  // Get the font to display in preview (hover preview or current selection)
  const displayPrimaryFont = hoveredPrimaryPreset?.value ?? primaryFont
  const displayMonoFont = hoveredMonoPreset?.value ?? monoFont

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Panel header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 16px',
        borderBottom: `1px solid ${colors.borderPrimary}`,
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Type size={14} style={{ color: colors.accent }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: colors.textPrimary }}>Typography</span>
        </div>
        <button
          onClick={handleReset}
          style={{
            border: `1px solid ${colors.borderPrimary}`,
            background: 'transparent',
            color: colors.textMuted,
            fontSize: 12,
            borderRadius: 4,
            padding: '4px 10px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <RotateCcw size={12} />
          Reset all
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          {/* Live Previews */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Eye size={13} style={{ color: colors.info }} />
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                color: colors.textMuted,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}>Preview</span>
            </div>

            {/* UI Font Preview */}
            <div
              style={{
                padding: 16,
                background: colors.bgPrimary,
                border: `1px solid ${colors.borderPrimary}`,
                borderRadius: 8,
                color: colors.textPrimary,
                fontFamily: displayPrimaryFont || 'system-ui, sans-serif',
                fontSize: `${fontSize}px`,
                lineHeight: lineHeight,
                letterSpacing: `${letterSpacing}em`,
                fontWeight: fontWeight,
              }}
            >
              <div style={{ fontSize: 12, color: colors.textMuted, marginBottom: 4, fontFamily: 'system-ui, sans-serif' }}>UI Font</div>
              {PREVIEW_TEXT}
            </div>

            {/* Mono Font Preview */}
            <div
              style={{
                padding: 16,
                background: colors.bgPrimary,
                border: `1px solid ${colors.borderPrimary}`,
                borderRadius: 8,
                color: colors.textPrimary,
                fontFamily: displayMonoFont || 'ui-monospace, monospace',
                fontSize: `${fontSize}px`,
                lineHeight: monoLineHeight,
              }}
            >
              <div style={{ fontSize: 12, color: colors.textMuted, marginBottom: 4, fontFamily: 'system-ui, sans-serif' }}>Monospace Font</div>
              {MONO_PREVIEW_TEXT}
            </div>
          </div>

          {/* Font Selection */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
            <FontSelector
              label="UI Font Family"
              options={UI_FONT_PRESETS}
              value={primaryPreset}
              onChange={handlePrimaryFontChange}
              onHover={handlePrimaryFontHover}
              hoveredPreset={hoveredPrimaryPreset}
              customValue={primaryCustomFont}
              onCustomChange={(v) => {
                setPrimaryCustomFont(v)
                setPrimaryFont(v)
              }}
            />

            <FontSelector
              label="Monospace Font Family"
              options={MONO_FONT_PRESETS}
              value={monoPreset}
              onChange={handleMonoFontChange}
              onHover={handleMonoFontHover}
              hoveredPreset={hoveredMonoPreset}
              customValue={monoCustomFont}
              onCustomChange={(v) => {
                setMonoCustomFont(v)
                setMonoFont(v)
              }}
            />
          </div>

          {/* Size & Spacing */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <SlidersHorizontal size={13} style={{ color: colors.warning }} />
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                color: colors.textMuted,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}>Size & Spacing</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <SliderControl
                label="Base Font Size"
                value={fontSize}
                min={10}
                max={20}
                step={1}
                unit="px"
                onChange={setFontSize}
                defaultValue={14}
              />
              <SliderControl
                label="Font Weight"
                value={fontWeight}
                min={100}
                max={900}
                step={100}
                unit=""
                onChange={setFontWeight}
                defaultValue={400}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
              <SliderControl
                label="UI Line Height"
                value={lineHeight}
                min={0.8}
                max={3.0}
                step={0.05}
                unit=""
                onChange={setLineHeight}
                defaultValue={1.5}
              />
              <SliderControl
                label="Code Line Height"
                value={monoLineHeight}
                min={0.8}
                max={2.5}
                step={0.05}
                unit=""
                onChange={setMonoLineHeight}
                defaultValue={1.4}
              />
              <SliderControl
                label="Letter Spacing"
                value={letterSpacing}
                min={-0.1}
                max={0.2}
                step={0.005}
                unit="em"
                onChange={setLetterSpacing}
                defaultValue={0}
              />
            </div>
          </div>

          {/* Rendering Options */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Paintbrush size={13} style={{ color: colors.success }} />
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                color: colors.textMuted,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}>Rendering</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
              <SegmentedControl
                label="Font Smoothing"
                options={FONT_SMOOTHING_OPTIONS}
                value={fontSmoothing}
                onChange={setFontSmoothing}
              />
              <SegmentedControl
                label="Text Rendering"
                options={TEXT_RENDERING_OPTIONS}
                value={textRendering}
                onChange={setTextRendering}
              />
            </div>

            <p style={{ margin: 0, color: colors.textMuted, fontSize: 12, opacity: 0.7 }}>
              <strong>Antialiased:</strong> Grayscale smoothing, thinner/cleaner text.
              <strong style={{ marginLeft: 8 }}>Subpixel:</strong> Uses RGB subpixels, bolder text but may show color fringing.
            </p>
          </div>

          {/* Help text */}
          <p style={{ margin: 0, color: colors.textMuted, fontSize: 12, opacity: 0.7 }}>
            Web fonts are loaded from Google Fonts. Hover over font options to preview before selecting.
          </p>
        </div>
      </div>
    </div>
  )
}
