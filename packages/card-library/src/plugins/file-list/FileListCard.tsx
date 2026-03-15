import { memo } from 'react'
import { Search, File, Folder } from 'lucide-react'
import type { BlockRenderProps } from '../../blocks/types'
import type { FileListData, FileListMatch } from './types'

export const FileListCard = memo(function FileListCard({
  data,
  detail,
  theme,
}: BlockRenderProps<FileListData>) {
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
        <Search size={10} color={theme.accent} style={{ flexShrink: 0 }} />
        {data.pattern && (
          <span style={{
            fontSize: '0.95em',
            color: theme.textPrimary,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}>
            {data.pattern}
          </span>
        )}
        <CountBadge count={data.count} theme={theme} truncated={data.truncated} />
      </div>
    )
  }

  if (detail === 'summary') {
    return (
      <div style={{
        padding: '6px 8px',
        background: theme.bgSecondary,
        borderRadius: theme.radius,
        borderLeft: `3px solid ${theme.accent}`,
        fontFamily: theme.fontSans,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Search size={10} color={theme.accent} style={{ flexShrink: 0 }} />
          {data.pattern && (
            <code style={{
              fontSize: '0.95em',
              color: theme.textPrimary,
              fontFamily: theme.fontMono,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
            }}>
              {data.pattern}
            </code>
          )}
          <CountBadge count={data.count} theme={theme} truncated={data.truncated} />
        </div>
      </div>
    )
  }

  // detail === 'full'
  const hasMatches = data.matches.length > 0
  return (
    <div style={{
      background: theme.bgSecondary,
      borderRadius: theme.radius,
      borderLeft: `3px solid ${theme.accent}`,
      overflow: 'hidden',
      fontFamily: theme.fontSans,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 10px',
        borderBottom: hasMatches ? `1px solid ${theme.borderPrimary}` : undefined,
      }}>
        <Search size={12} color={theme.accent} style={{ flexShrink: 0 }} />
        {data.pattern && (
          <code style={{
            fontSize: '0.95em',
            color: theme.textPrimary,
            fontFamily: theme.fontMono,
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {data.pattern}
          </code>
        )}
        <CountBadge count={data.count} theme={theme} truncated={data.truncated} />
      </div>

      {/* File list */}
      {hasMatches && (
        <div style={{ maxHeight: 300, overflow: 'auto', padding: '4px 0' }}>
          {data.matches.map((match, i) => (
            <MatchRow key={i} match={match} theme={theme} />
          ))}
        </div>
      )}
    </div>
  )
})

function MatchRow({ match, theme }: { match: FileListMatch; theme: BlockRenderProps['theme'] }) {
  const isDir = match.type === 'directory'
  const Icon = isDir ? Folder : File
  const iconColor = isDir ? theme.warning : theme.textMuted

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 6,
      padding: '2px 10px',
      fontSize: '0.95em',
      fontFamily: theme.fontMono,
      lineHeight: 1.4,
    }}>
      <Icon size={11} color={iconColor} style={{ flexShrink: 0, marginTop: 2 }} />
      <span style={{ color: theme.textPrimary, flex: 1, wordBreak: 'break-all' }}>
        {match.path}
        {match.line !== undefined && (
          <span style={{ color: theme.textMuted }}>:{match.line}</span>
        )}
      </span>
      {match.text && (
        <span style={{
          color: theme.textSecondary,
          fontSize: '0.9em',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          maxWidth: '50%',
        }}>
          {match.text}
        </span>
      )}
    </div>
  )
}

function CountBadge({
  count,
  theme,
  truncated,
}: {
  count: number
  theme: { accent: string; textMuted: string }
  truncated?: boolean
}) {
  return (
    <span style={{
      fontSize: '0.85em',
      fontWeight: 600,
      padding: '1px 6px',
      borderRadius: 3,
      background: `${theme.accent}22`,
      color: theme.accent,
      whiteSpace: 'nowrap',
      fontVariantNumeric: 'tabular-nums',
    }}>
      {count}{truncated && '+'}
    </span>
  )
}
