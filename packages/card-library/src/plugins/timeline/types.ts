/** Status values for timeline phases and tasks */
export type TimelineStatus = 'done' | 'in-progress' | 'todo' | 'blocked'

/** A single task within a timeline phase */
export interface TimelineTask {
  title: string
  status: TimelineStatus
}

/** A phase in the timeline (maps to a horizontal gantt bar) */
export interface TimelinePhase {
  name: string
  /** ISO date string: YYYY-MM-DD */
  start: string
  /** ISO date string: YYYY-MM-DD */
  end: string
  status: TimelineStatus
  tasks: TimelineTask[]
}

/** Parsed data from a ```timeline fenced block */
export interface TimelineData {
  title?: string
  phases: TimelinePhase[]
}

/** Status display labels */
export const TIMELINE_STATUS_LABELS: Record<TimelineStatus, string> = {
  done: 'Done',
  'in-progress': 'In Progress',
  todo: 'To Do',
  blocked: 'Blocked',
}

/** Status accent colors — hex values used for phase bars and task chips */
export const TIMELINE_STATUS_COLORS: Record<TimelineStatus, string> = {
  done: '#22c55e',
  'in-progress': '#3b82f6',
  todo: '#6b7280',
  blocked: '#ef4444',
}

/** Parse a YYYY-MM-DD date string to a UTC midnight timestamp (ms).
 *  Returns NaN for invalid inputs. */
export function parseDateMs(dateStr: string): number {
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return NaN
  const [, y, m, d] = match
  return Date.UTC(Number(y), Number(m) - 1, Number(d))
}

/** Format a UTC ms timestamp to a short label: "Mar 1" */
export function formatDateLabel(ms: number): string {
  const d = new Date(ms)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}
