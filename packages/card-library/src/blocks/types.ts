export type BlockTypeId = string

export type BlockSourceRange = {
  startOffset: number | null
  endOffset: number | null
  startLine: number | null
  endLine: number | null
}

export type BlockSource = {
  filePath: string
  range: BlockSourceRange
  raw: string
}

export type BlockParseError = {
  message: string
  line?: number
  column?: number
}

export type BlockInstance<T = unknown> = {
  type: BlockTypeId
  data: T | null
  source: BlockSource
  errors?: BlockParseError[]
}

export type BlockDefinition<T = unknown> = {
  type: BlockTypeId
  name: string
  schemaVersion?: number
  toContextMarkdown?: (blocks: BlockInstance<T>[]) => string
  validate?: (data: T) => BlockParseError[]
  toRuntime?: (data: T) => T
}

export type BlockRuntime<T = unknown> = {
  type: BlockTypeId
  schemaVersion: number
  data: T
}
