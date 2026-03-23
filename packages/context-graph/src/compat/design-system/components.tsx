// Minimal component stubs — same API as LG design system components
// These are lightweight replacements, not full ports

import React, { type ReactNode, type CSSProperties } from 'react'
import type { LucideIcon } from 'lucide-react'
import { useTheme } from './ThemeProvider'

// --- ButtonGroup ---

interface ButtonGroupProps {
  children: ReactNode
  style?: CSSProperties
}

export function ButtonGroup({ children, style }: ButtonGroupProps) {
  const { colors } = useTheme()
  return (
    <div style={{
      display: 'inline-flex',
      border: `1px solid ${colors.borderPrimary}`,
      borderRadius: '6px',
      overflow: 'hidden',
      ...style,
    }}>
      {children}
    </div>
  )
}

interface ButtonGroupItemProps {
  children: ReactNode
  active?: boolean
  style?: CSSProperties
  onClick?: () => void
}

export function ButtonGroupItem({ children, active, style, onClick }: ButtonGroupItemProps) {
  const { colors } = useTheme()
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        border: 'none',
        padding: '4px 8px',
        fontSize: '11px',
        fontWeight: 600,
        cursor: 'pointer',
        background: active ? colors.accent : 'transparent',
        color: active ? colors.textInverse : colors.textPrimary,
        ...style,
      }}
    >
      {children}
    </button>
  )
}

// --- Select ---

interface SelectProps {
  value: string
  onChange: (event: { target: { value: string } }) => void
  options: Array<{ value: string; label: string }>
  size?: 'sm' | 'md'
  style?: CSSProperties
}

export function Select({ value, onChange, options, size = 'md', style }: SelectProps) {
  const { colors } = useTheme()
  return (
    <select
      value={value}
      onChange={onChange as any}
      style={{
        background: colors.bgPrimary,
        color: colors.textPrimary,
        border: `1px solid ${colors.borderPrimary}`,
        borderRadius: '4px',
        padding: size === 'sm' ? '2px 6px' : '4px 8px',
        fontSize: size === 'sm' ? '10px' : '12px',
        cursor: 'pointer',
        ...style,
      }}
    >
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  )
}

// --- Editor (Monaco wrapper) ---

import MonacoEditor from '@monaco-editor/react'

interface EditorProps {
  value: string
  language?: string
  readOnly?: boolean
  lineNumbers?: boolean
  wordWrap?: boolean
  minimap?: boolean
  height?: string | number
  style?: CSSProperties
}

export function Editor({ value, language, readOnly, lineNumbers = true, wordWrap, minimap = false, height = '100%', style }: EditorProps) {
  const { isDark } = useTheme()
  return (
    <div style={{ height, ...style }}>
      <MonacoEditor
        value={value}
        language={language}
        theme={isDark ? 'vs-dark' : 'light'}
        height="100%"
        options={{
          readOnly,
          lineNumbers: lineNumbers ? 'on' : 'off',
          wordWrap: wordWrap ? 'on' : 'off',
          minimap: { enabled: minimap },
          scrollBeyondLastLine: false,
          fontSize: 12,
          automaticLayout: true,
        }}
      />
    </div>
  )
}

// --- Icon ---

const sizeMap: Record<string, number> = { xs: 12, sm: 14, md: 16, lg: 20, xl: 24 }

interface IconProps {
  icon?: LucideIcon | React.ComponentType<any>
  name?: string
  size?: number | string
  color?: string
  style?: CSSProperties
  [key: string]: any
}

export function Icon({ icon: IconComponent, name, size = 'md', color, style, ...props }: IconProps) {
  const px = typeof size === 'number' ? size : (sizeMap[size] ?? 16)
  if (IconComponent) {
    return <IconComponent size={px} color={color} style={style} {...props} />
  }
  return <span style={{ fontSize: px, color, ...style }} {...props}>{name ?? '?'}</span>
}
