export interface NoteData {
  id?: string
  title: string
  content: string
  noteType?: string  // reference, decision, observation, idea, meeting, log
  tags?: string[]
  entityLinks?: Array<{ entityType: string; entityName?: string; entityId?: string; strength?: number }>
  active?: boolean
  createdAt?: string
  updatedAt?: string
}

export const noteTypeColors: Record<string, string> = {
  reference: '#3b82f6',
  decision: '#8b5cf6',
  observation: '#14b8a6',
  idea: '#f59e0b',
  meeting: '#ec4899',
  log: '#84cc16',
}
