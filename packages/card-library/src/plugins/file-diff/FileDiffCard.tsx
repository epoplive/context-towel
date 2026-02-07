import { memo } from 'react'
import { FileDiff as FileDiffIcon } from 'lucide-react'
import type { BlockRenderProps } from '../../blocks/types'
import type { FileDiffData } from './types'

export const FileDiffCard = memo(function FileDiffCard({
  data,
  detail,
  theme,
}: BlockRenderProps<FileDiffData>) {
  const filename = data.path.split('/').pop() || data.path
  const hasHunks = data.hunks && data.hunks.length > 0

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
        <FileDiffIcon size={10} color={theme.warning} style={{ flexShrink: 0 }} />
        <span style={{
          fontSize: 11,
          color: theme.textPrimary,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
        }}>
          {filename}
        </span>
        <ChangesBadge additions={data.additions} deletions={data.deletions} theme={theme} />
      </div>
    )
  }

  if (detail === 'summary') {
    return (
      <div style={{
        padding: '6px 8px',
        background: theme.bgSecondary,
        borderRadius: theme.radius,
        borderLeft: `3px solid ${theme.warning}`,
        fontFamily: theme.fontSans,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <FileDiffIcon size={10} color={theme.warning} style={{ flexShrink: 0 }} />
          <span style={{
            fontSize: 11,
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
          <ChangesBadge additions={data.additions} deletions={data.deletions} theme={theme} />
        </div>
      </div>
    )
  }

  // detail === 'full'
  return (
    <div style={{
      background: theme.bgSecondary,
      borderRadius: theme.radius,
      borderLeft: `3px solid ${theme.warning}`,
      overflow: 'hidden',
      fontFamily: theme.fontSans,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 10px',
        borderBottom: hasHunks ? `1px solid ${theme.borderPrimary}` : undefined,
      }}>
        <FileDiffIcon size={12} color={theme.warning} style={{ flexShrink: 0 }} />
        <span style={{
          fontSize: 11,
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
        {data.language && (
          <span style={{
            fontSize: 8,
            color: theme.textMuted,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            {data.language}
          </span>
        )}
        <ChangesBadge additions={data.additions} deletions={data.deletions} theme={theme} />
      </div>

      {/* Hunks */}
      {hasHunks && (
        <div style={{ maxHeight: 400, overflow: 'auto' }}>
          {data.hunks!.map((hunk, i) => (
            <div key={i} style={{
              borderBottom: i < data.hunks!.length - 1 ? `1px solid ${theme.borderPrimary}` : undefined,
            }}>
              {/* Before (deletions) */}
              {hunk.before && (
                <pre style={{
                  margin: 0,
                  padding: '4px 10px',
                  fontSize: 11,
                  lineHeight: 1.4,
                  fontFamily: theme.fontMono,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}>
                  {hunk.before.split('\n').map((line, j) => (
                    <div key={`d-${j}`} style={{
                      background: `${theme.error}15`,
                      color: theme.error,
                      marginLeft: -10,
                      marginRight: -10,
                      paddingLeft: 10,
                      paddingRight: 10,
                    }}>
                      <span style={{ opacity: 0.5, userSelect: 'none' }}>- </span>{line}
                    </div>
                  ))}
                </pre>
              )}
              {/* After (additions) */}
              {hunk.after && (
                <pre style={{
                  margin: 0,
                  padding: '4px 10px',
                  fontSize: 11,
                  lineHeight: 1.4,
                  fontFamily: theme.fontMono,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}>
                  {hunk.after.split('\n').map((line, j) => (
                    <div key={`a-${j}`} style={{
                      background: `${theme.success}15`,
                      color: theme.success,
                      marginLeft: -10,
                      marginRight: -10,
                      paddingLeft: 10,
                      paddingRight: 10,
                    }}>
                      <span style={{ opacity: 0.5, userSelect: 'none' }}>+ </span>{line}
                    </div>
                  ))}
                </pre>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
})

function ChangesBadge({
  additions,
  deletions,
  theme,
}: {
  additions: number
  deletions: number
  theme: { success: string; error: string }
}) {
  return (
    <span style={{
      display: 'flex',
      gap: 4,
      fontSize: 9,
      fontWeight: 600,
      fontVariantNumeric: 'tabular-nums',
    }}>
      {additions > 0 && (
        <span style={{ color: theme.success }}>+{additions}</span>
      )}
      {deletions > 0 && (
        <span style={{ color: theme.error }}>-{deletions}</span>
      )}
    </span>
  )
}
