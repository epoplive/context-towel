export interface FileContentData {
  path: string
  language?: string
  action?: 'read' | 'created' | 'written'
  lines?: number
  content?: string
}
