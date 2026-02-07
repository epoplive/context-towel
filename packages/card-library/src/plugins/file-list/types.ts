export interface FileListMatch {
  path: string
  type?: 'file' | 'directory'
  line?: number
  text?: string
}

export interface FileListData {
  pattern?: string
  matches: FileListMatch[]
  count: number
  truncated?: boolean
}
