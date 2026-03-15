import { memo } from 'react'
import { FileText, FilePlus, FileOutput } from 'lucide-react'
import type { BlockRenderProps } from '../../blocks/types'
import type { FileContentData } from './types'
import { CodeBlock } from '../../components/CodeBlock'
import { CopyButton } from '../../components/CopyButton'

const actionIcons = {
  read: FileText,
  created: FilePlus,
  written: FileOutput,
} as const

const actionColors: Record<string, string> = {
  read: '#3b82f6',
  created: '#22c55e',
  written: '#f59e0b',
}

export const FileContentCard = memo(function FileContentCard({
  data,
  detail,
  theme,
  highlighter,
}: BlockRenderProps<FileContentData>) {
  const filename = data.path.split('/').pop() || data.path
  const action = data.action || 'read'
  const Icon = actionIcons[action] || FileText
  const accentColor = actionColors[action] || theme.accent

  if (detail === 'mini') {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 8px',
        background: theme.bgSecondary,
        borderRadius: theme.radius,
        fontFamily: theme.fontMono,
      }}>
        <Icon size={10} color={accentColor} style={{ flexShrink: 0 }} />
        <span style={{
          fontSize: '0.95em',
          color: theme.textPrimary,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
        }}>
          {filename}
        </span>
        {data.lines !== undefined && (
          <span style={{ fontSize: '0.85em', color: theme.textMuted }}>{data.lines}L</span>
        )}
      </div>
    )
  }

  if (detail === 'summary') {
    return (
      <div style={{
        padding: '6px 8px',
        background: theme.bgSecondary,
        borderRadius: theme.radius,
        borderLeft: `3px solid ${accentColor}`,
        fontFamily: theme.fontSans,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon size={10} color={accentColor} style={{ flexShrink: 0 }} />
          <span style={{
            fontSize: '0.95em',
            color: theme.textPrimary,
            fontWeight: 600,
            fontFamily: theme.fontMono,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}>
            {data.path}
          </span>
          {data.lines !== undefined && (
            <span style={{ fontSize: '0.85em', color: theme.textMuted }}>{data.lines} lines</span>
          )}
          <ActionBadge action={action} color={accentColor} />
        </div>
      </div>
    )
  }

  // detail === 'full'
  return (
    <div style={{
      background: theme.bgSecondary,
      borderRadius: theme.radius,
      borderLeft: `3px solid ${accentColor}`,
      overflow: 'hidden',
      fontFamily: theme.fontSans,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 10px',
        borderBottom: data.content ? `1px solid ${theme.borderPrimary}` : undefined,
      }}>
        <Icon size={12} color={accentColor} style={{ flexShrink: 0 }} />
        <span style={{
          fontSize: '0.95em',
          color: theme.textPrimary,
          fontWeight: 600,
          fontFamily: theme.fontMono,
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {data.path}
        </span>
        {data.lines !== undefined && (
          <span style={{ fontSize: '0.85em', color: theme.textMuted }}>{data.lines} lines</span>
        )}
        {data.language && (
          <span style={{
            fontSize: '0.8em',
            color: theme.textMuted,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            {data.language}
          </span>
        )}
        <ActionBadge action={action} color={accentColor} />
        {data.content && <CopyButton text={data.content} theme={theme} size={11} />}
      </div>

      {/* Content */}
      {data.content && (
        <CodeBlock
          code={data.content}
          language={data.language}
          theme={theme}
          highlighter={highlighter}
          maxHeight={400}
          showCopy={false}
        />
      )}
    </div>
  )
})

function ActionBadge({ action, color }: { action: string; color: string }) {
  return (
    <span style={{
      fontSize: '0.8em',
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      padding: '1px 6px',
      borderRadius: 3,
      background: `${color}22`,
      color,
      whiteSpace: 'nowrap',
    }}>
      {action}
    </span>
  )
}
