// ============================================================================
// Log Plugin Types - Work log entries
// ============================================================================

import { ExtractedItem } from '../../types'

export interface LogEntry {
  timestamp: string       // [YYYY-MM-DD HH:MM] format
  action: string          // What was done
  result?: string         // Outcome or decision
  next?: string           // What follows
}

export interface LogSection extends ExtractedItem {
  title: string           // Section title (usually "Log" or parent heading)
  entries: LogEntry[]
}
