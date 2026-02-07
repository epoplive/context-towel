import { memo, type ReactNode } from 'react'
import type { ThemeTokens } from '../blocks/types'
import { CopyButton } from './CopyButton'

interface CodeBlockProps {
  code: string
  language?: string
  theme: ThemeTokens
  maxHeight?: number
  showCopy?: boolean
  /** Host-provided syntax highlighter. Falls back to plain <pre> */
  highlighter?: (code: string, lang: string) => ReactNode
}

export const CodeBlock = memo(function CodeBlock({
  code,
  language,
  theme,
  maxHeight = 300,
  showCopy = true,
  highlighter,
}: CodeBlockProps) {
  const highlighted = language && highlighter ? highlighter(code, language) : null

  return (
    <div style={{
      background: theme.bgTertiary,
      borderRadius: theme.radius,
      border: `1px solid ${theme.borderPrimary}`,
      overflow: 'hidden',
      position: 'relative',
    }}>
      {showCopy && (
        <div style={{ position: 'absolute', top: 4, right: 4, zIndex: 1 }}>
          <CopyButton text={code} theme={theme} size={11} />
        </div>
      )}
      {highlighted ? (
        <div style={{ maxHeight, overflow: 'auto', padding: '8px 10px' }}>
          {highlighted}
        </div>
      ) : (
        <pre style={{
          margin: 0,
          padding: '8px 10px',
          maxHeight,
          overflow: 'auto',
          fontSize: 11,
          lineHeight: 1.4,
          fontFamily: theme.fontMono,
          color: theme.textPrimary,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}>
          {code}
        </pre>
      )}
    </div>
  )
})
