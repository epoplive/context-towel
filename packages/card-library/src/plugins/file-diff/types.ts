export interface DiffHunk {
  before: string
  after: string
}

export interface FileDiffData {
  path: string
  language?: string
  additions: number
  deletions: number
  hunks?: DiffHunk[]
}
