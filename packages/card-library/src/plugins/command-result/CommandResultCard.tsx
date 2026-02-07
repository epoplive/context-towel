import { memo } from 'react'
import { Terminal } from 'lucide-react'
import type { BlockRenderProps } from '../../blocks/types'
import type { CommandResultData } from './types'
import { CopyButton } from '../../components/CopyButton'

export const CommandResultCard = memo(function CommandResultCard({
  data,
  detail,
  theme,
}: BlockRenderProps<CommandResultData>) {
  const isSuccess = data.exitCode === 0
  const exitColor = isSuccess ? theme.success : theme.error

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
        <Terminal size={10} color={theme.textMuted} style={{ flexShrink: 0 }} />
        <span style={{
          fontSize: 11,
          color: theme.textPrimary,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
        }}>
          $ {data.command}
        </span>
        <ExitBadge code={data.exitCode} color={exitColor} />
      </div>
    )
  }

  if (detail === 'summary') {
    const firstLine = data.output?.split('\n')[0] || ''
    return (
      <div style={{
        padding: '6px 8px',
        background: theme.bgSecondary,
        borderRadius: theme.radius,
        borderLeft: `3px solid ${exitColor}`,
        fontFamily: theme.fontSans,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <Terminal size={10} color={theme.textMuted} style={{ flexShrink: 0 }} />
          <code style={{
            fontSize: 11,
            color: theme.textPrimary,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
            fontFamily: theme.fontMono,
          }}>
            $ {data.command}
          </code>
          <ExitBadge code={data.exitCode} color={exitColor} />
          {data.duration !== undefined && (
            <span style={{ fontSize: 9, color: theme.textMuted }}>{data.duration}s</span>
          )}
        </div>
        {firstLine && (
          <div style={{
            fontSize: 10,
            color: theme.textSecondary,
            fontFamily: theme.fontMono,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {firstLine}
          </div>
        )}
      </div>
    )
  }

  // detail === 'full'
  return (
    <div style={{
      background: theme.bgSecondary,
      borderRadius: theme.radius,
      borderLeft: `3px solid ${exitColor}`,
      overflow: 'hidden',
      fontFamily: theme.fontSans,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 10px',
        borderBottom: data.output ? `1px solid ${theme.borderPrimary}` : undefined,
      }}>
        <Terminal size={12} color={theme.textMuted} style={{ flexShrink: 0 }} />
        <code style={{
          fontSize: 11,
          color: theme.textPrimary,
          flex: 1,
          fontFamily: theme.fontMono,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          $ {data.command}
        </code>
        <ExitBadge code={data.exitCode} color={exitColor} />
        {data.duration !== undefined && (
          <span style={{ fontSize: 9, color: theme.textMuted }}>{data.duration}s</span>
        )}
        {data.output && <CopyButton text={data.output} theme={theme} size={11} />}
      </div>

      {/* Output */}
      {data.output && (
        <pre style={{
          margin: 0,
          padding: '8px 10px',
          maxHeight: 300,
          overflow: 'auto',
          fontSize: 11,
          lineHeight: 1.4,
          fontFamily: theme.fontMono,
          color: theme.textPrimary,
          background: theme.bgTertiary,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}>
          {data.output}
        </pre>
      )}
    </div>
  )
})

function ExitBadge({ code, color }: { code: number; color: string }) {
  return (
    <span style={{
      fontSize: 8,
      fontWeight: 700,
      padding: '1px 6px',
      borderRadius: 3,
      background: `${color}22`,
      color,
      whiteSpace: 'nowrap',
      fontVariantNumeric: 'tabular-nums',
    }}>
      {code === 0 ? 'OK' : `EXIT ${code}`}
    </span>
  )
}
