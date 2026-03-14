import { memo } from 'react'
import type { BlockRenderProps } from '../../blocks/types'
import type { NodeBlockData, NodeState, ZoomLayer } from './types'
import { nodeStateColors, zoomLayerLabels } from './types'

/** State badge — colored dot + label */
function StateBadge({ state }: { state: NodeState }) {
  const color = nodeStateColors[state]
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 4,
      fontSize: 7,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      padding: '1px 5px',
      borderRadius: 3,
      background: `${color}22`,
      color,
      whiteSpace: 'nowrap',
    }}>
      <span style={{
        width: 6,
        height: 6,
        borderRadius: '50%',
        background: color,
        display: 'inline-block',
        flexShrink: 0,
      }} />
      {state}
    </span>
  )
}

/** Layer badge — shows the zoom layer */
function LayerBadge({ layer, color }: { layer: ZoomLayer; color: string }) {
  return (
    <span style={{
      fontSize: 7,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      padding: '1px 5px',
      borderRadius: 3,
      background: `${color}15`,
      color,
      whiteSpace: 'nowrap',
    }}>
      {zoomLayerLabels[layer]}
    </span>
  )
}

/** Style a single body line — dims dead paths, highlights proven paths */
function BodyLine({ line, theme }: { line: string; theme: BlockRenderProps['theme'] }) {
  const isDead = line.startsWith('\u{1F480}')   // skull emoji
  const isProven = line.startsWith('\u2713')     // check mark

  let color = theme.textSecondary
  let opacity = 1
  if (isDead) {
    color = theme.textMuted
    opacity = 0.6
  } else if (isProven) {
    color = theme.success
  }

  return (
    <div style={{ color, opacity }}>
      {line}
    </div>
  )
}

/** Node card — renders a ~~~node block at different detail levels */
export const NodeCard = memo(function NodeCard({
  data,
  detail,
  theme,
}: BlockRenderProps<NodeBlockData>) {
  const stateColor = nodeStateColors[data.state]

  if (detail === 'mini') {
    return (
      <div style={{
        borderLeft: `3px solid ${stateColor}`,
        padding: '4px 8px',
        background: theme.bgSecondary,
        borderRadius: theme.radius,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: theme.fontSans,
      }}>
        <StateBadge state={data.state} />
        <span style={{
          fontSize: 11,
          color: theme.textPrimary,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
          fontFamily: theme.fontMono,
        }}>
          {data.id}
        </span>
        {data.layer && <LayerBadge layer={data.layer} color={theme.accent} />}
      </div>
    )
  }

  if (detail === 'summary') {
    const bodyPreview = data.body.split('\n').slice(0, 3).join('\n')
    const truncated = data.body.split('\n').length > 3

    return (
      <div style={{
        borderLeft: `3px solid ${stateColor}`,
        padding: '6px 8px',
        background: theme.bgSecondary,
        borderRadius: theme.radius,
        fontFamily: theme.fontSans,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <StateBadge state={data.state} />
          <span style={{
            fontSize: 11,
            color: theme.textPrimary,
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
            fontFamily: theme.fontMono,
          }}>
            {data.id}
          </span>
          {data.layer && <LayerBadge layer={data.layer} color={theme.accent} />}
        </div>

        {bodyPreview && (
          <pre style={{
            fontSize: 9,
            color: theme.textSecondary,
            fontFamily: theme.fontMono,
            margin: 0,
            whiteSpace: 'pre-wrap',
            lineHeight: 1.4,
          }}>
            {bodyPreview}{truncated ? '\n...' : ''}
          </pre>
        )}
      </div>
    )
  }

  // detail === 'full'
  const bodyLines = data.body.split('\n')

  return (
    <div style={{
      borderLeft: `3px solid ${stateColor}`,
      padding: '8px 10px',
      background: theme.bgSecondary,
      borderRadius: theme.radius,
      fontFamily: theme.fontSans,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <StateBadge state={data.state} />
        <span style={{
          fontSize: 12,
          color: theme.textPrimary,
          fontWeight: 600,
          flex: 1,
          fontFamily: theme.fontMono,
        }}>
          {data.id}
        </span>
        {data.layer && <LayerBadge layer={data.layer} color={theme.accent} />}
      </div>

      {/* Metadata row */}
      {(data.subsystem || data.maps) && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
          {data.subsystem && (
            <span style={{
              fontSize: 8,
              padding: '1px 5px',
              borderRadius: 3,
              background: `${theme.accent}22`,
              color: theme.accent,
            }}>
              {data.subsystem}
            </span>
          )}
          {data.maps && (
            <span style={{
              fontSize: 8,
              padding: '1px 5px',
              borderRadius: 3,
              background: theme.bgTertiary,
              color: theme.textSecondary,
            }}>
              maps: {data.maps}
            </span>
          )}
        </div>
      )}

      {/* Body */}
      {data.body && (
        <pre style={{
          fontSize: 10,
          fontFamily: theme.fontMono,
          margin: 0,
          whiteSpace: 'pre-wrap',
          lineHeight: 1.5,
        }}>
          {bodyLines.map((line, i) => (
            <BodyLine key={i} line={line} theme={theme} />
          ))}
        </pre>
      )}
    </div>
  )
})
