import type { BlockRenderProps } from '../../blocks/types'
import type { TimelineData, TimelinePhase, TimelineStatus } from './types'
import {
  TIMELINE_STATUS_COLORS,
  TIMELINE_STATUS_LABELS,
  formatDateLabel,
  parseDateMs,
} from './types'

// ============================================================================
// Date axis helpers
// ============================================================================

/** Build evenly-spaced tick marks for the date axis. */
function buildDateTicks(startMs: number, endMs: number, tickCount: number): number[] {
  const totalMs = endMs - startMs
  if (totalMs <= 0) return [startMs]
  const ticks: number[] = []
  for (let i = 0; i <= tickCount; i++) {
    ticks.push(startMs + (totalMs * i) / tickCount)
  }
  return ticks
}

/** Clamp a percentage to [0, 100] */
function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value))
}

// ============================================================================
// Phase row
// ============================================================================

function PhaseRow({
  phase,
  startMs,
  totalMs,
  theme,
}: {
  phase: TimelinePhase
  startMs: number
  totalMs: number
  theme: BlockRenderProps<TimelineData>['theme']
}) {
  const phaseStartMs = parseDateMs(phase.start)
  const phaseEndMs = parseDateMs(phase.end)

  // Fall back gracefully if dates are invalid
  const leftPct = isNaN(phaseStartMs)
    ? 0
    : clamp(((phaseStartMs - startMs) / totalMs) * 100)
  const widthPct = isNaN(phaseStartMs) || isNaN(phaseEndMs)
    ? 10
    : clamp(((phaseEndMs - phaseStartMs) / totalMs) * 100, 1)

  const color = TIMELINE_STATUS_COLORS[phase.status] ?? TIMELINE_STATUS_COLORS.todo
  const statusLabel = TIMELINE_STATUS_LABELS[phase.status] ?? phase.status

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35em' }}>
      {/* Phase bar row */}
      <div style={{ position: 'relative', height: '1.6em' }}>
        {/* Bar */}
        <div
          style={{
            position: 'absolute',
            left: `${leftPct}%`,
            width: `${widthPct}%`,
            height: '100%',
            borderRadius: theme.radius,
            background: `${color}33`,
            border: `1.5px solid ${color}`,
            boxSizing: 'border-box',
            display: 'flex',
            alignItems: 'center',
            paddingLeft: '0.45em',
            paddingRight: '0.45em',
            overflow: 'hidden',
            minWidth: '2em',
          }}
          title={`${phase.name} — ${statusLabel} (${phase.start} → ${phase.end})`}
        >
          <span
            style={{
              fontSize: '0.85em',
              fontWeight: 700,
              color: color,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              maxWidth: '100%',
            }}
          >
            {phase.name}
          </span>
        </div>
      </div>

      {/* Task chips row */}
      {phase.tasks.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0.3em',
            paddingLeft: `${leftPct}%`,
          }}
        >
          {phase.tasks.map((task, i) => {
            const taskColor = TIMELINE_STATUS_COLORS[task.status] ?? TIMELINE_STATUS_COLORS.todo
            return (
              <span
                key={i}
                title={`${task.title} — ${TIMELINE_STATUS_LABELS[task.status] ?? task.status}`}
                style={{
                  fontSize: '0.8em',
                  fontWeight: 600,
                  padding: '0.15em 0.5em',
                  borderRadius: '999px',
                  background: `${taskColor}22`,
                  border: `1px solid ${taskColor}88`,
                  color: taskColor,
                  whiteSpace: 'nowrap',
                }}
              >
                {task.title}
              </span>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// Today marker
// ============================================================================

function TodayMarker({
  startMs,
  totalMs,
  theme,
}: {
  startMs: number
  totalMs: number
  theme: BlockRenderProps<TimelineData>['theme']
}) {
  const todayMs = Date.UTC(
    new Date().getUTCFullYear(),
    new Date().getUTCMonth(),
    new Date().getUTCDate()
  )
  if (todayMs < startMs || todayMs > startMs + totalMs) return null

  const leftPct = clamp(((todayMs - startMs) / totalMs) * 100)

  return (
    <div
      style={{
        position: 'absolute',
        left: `${leftPct}%`,
        top: 0,
        bottom: 0,
        width: '1.5px',
        background: theme.warning,
        pointerEvents: 'none',
        zIndex: 1,
      }}
      title={`Today — ${formatDateLabel(todayMs)}`}
    />
  )
}

// ============================================================================
// Date axis
// ============================================================================

function DateAxis({
  startMs,
  totalMs,
  theme,
}: {
  startMs: number
  totalMs: number
  theme: BlockRenderProps<TimelineData>['theme']
}) {
  const ticks = buildDateTicks(startMs, startMs + totalMs, 4)

  return (
    <div
      style={{
        position: 'relative',
        height: '1.4em',
        borderTop: `1px solid ${theme.borderPrimary}`,
      }}
    >
      {ticks.map((ms, i) => {
        const leftPct = clamp(((ms - startMs) / totalMs) * 100)
        return (
          <span
            key={i}
            style={{
              position: 'absolute',
              left: `${leftPct}%`,
              transform: i === ticks.length - 1 ? 'translateX(-100%)' : i === 0 ? 'none' : 'translateX(-50%)',
              fontSize: '0.75em',
              color: theme.textMuted,
              fontWeight: 500,
              top: '0.25em',
              whiteSpace: 'nowrap',
            }}
          >
            {formatDateLabel(ms)}
          </span>
        )
      })}
    </div>
  )
}

// ============================================================================
// Legend
// ============================================================================

const LEGEND_STATUSES: TimelineStatus[] = ['done', 'in-progress', 'todo', 'blocked']

function Legend({ theme }: { theme: BlockRenderProps<TimelineData>['theme'] }) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '0.6em',
        paddingTop: '0.4em',
        borderTop: `1px solid ${theme.borderPrimary}`,
      }}
    >
      {LEGEND_STATUSES.map(status => {
        const color = TIMELINE_STATUS_COLORS[status]
        return (
          <div
            key={status}
            style={{ display: 'flex', alignItems: 'center', gap: '0.3em' }}
          >
            <span
              style={{
                display: 'inline-block',
                width: '0.55em',
                height: '0.55em',
                borderRadius: '2px',
                background: color,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: '0.8em',
                color: theme.textMuted,
                fontWeight: 500,
              }}
            >
              {TIMELINE_STATUS_LABELS[status]}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ============================================================================
// TimelineCard — the main exported card component
// ============================================================================

export function TimelineCard({ data, theme }: BlockRenderProps<TimelineData>) {
  if (data.phases.length === 0) {
    return (
      <div
        style={{
          fontFamily: theme.fontSans,
          color: theme.textMuted,
          fontSize: '0.95em',
          padding: '0.6em 0',
        }}
      >
        No phases defined.
      </div>
    )
  }

  // Compute overall timeline bounds from phase dates
  let startMs = Infinity
  let endMs = -Infinity

  for (const phase of data.phases) {
    const s = parseDateMs(phase.start)
    const e = parseDateMs(phase.end)
    if (!isNaN(s) && s < startMs) startMs = s
    if (!isNaN(e) && e > endMs) endMs = e
  }

  // Fall back if no valid dates found
  if (!isFinite(startMs) || !isFinite(endMs) || endMs <= startMs) {
    startMs = Date.now()
    endMs = startMs + 30 * 24 * 60 * 60 * 1000
  }

  const totalMs = endMs - startMs

  return (
    <div
      style={{
        fontFamily: theme.fontSans,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5em',
      }}
    >
      {/* Title */}
      {data.title && (
        <div
          style={{
            fontSize: '0.95em',
            fontWeight: 700,
            color: theme.textPrimary,
            paddingBottom: '0.2em',
          }}
        >
          {data.title}
        </div>
      )}

      {/* Gantt area */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5em',
        }}
      >
        {/* Today marker spans the full height of the gantt area */}
        <TodayMarker startMs={startMs} totalMs={totalMs} theme={theme} />

        {/* Phase rows */}
        {data.phases.map((phase, i) => (
          <PhaseRow
            key={i}
            phase={phase}
            startMs={startMs}
            totalMs={totalMs}
            theme={theme}
          />
        ))}
      </div>

      {/* Date axis */}
      <DateAxis startMs={startMs} totalMs={totalMs} theme={theme} />

      {/* Legend */}
      <Legend theme={theme} />
    </div>
  )
}
