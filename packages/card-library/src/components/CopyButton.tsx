import { useState, useCallback, memo } from 'react'
import { Copy, Check } from 'lucide-react'
import type { ThemeTokens } from '../blocks/types'

interface CopyButtonProps {
  text: string
  theme: ThemeTokens
  size?: number
}

export const CopyButton = memo(function CopyButton({ text, theme, size = 12 }: CopyButtonProps) {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }, [text])

  const Icon = copied ? Check : Copy
  const color = copied ? theme.success : theme.textMuted

  return (
    <button
      onClick={handleCopy}
      title={copied ? 'Copied!' : 'Copy'}
      style={{
        background: 'none',
        border: 'none',
        padding: 2,
        cursor: 'pointer',
        color,
        display: 'flex',
        alignItems: 'center',
        flexShrink: 0,
        opacity: copied ? 1 : 0.6,
        transition: 'opacity 0.15s',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.opacity = '1' }}
      onMouseLeave={(e) => { if (!copied) e.currentTarget.style.opacity = '0.6' }}
    >
      <Icon size={size} />
    </button>
  )
})
