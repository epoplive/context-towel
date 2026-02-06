export type WidgetType =
  | 'card'
  | 'grid'
  | 'text'
  | 'list'
  | 'form'
  | 'table'
  | 'row'
  | 'column'
  | 'item'
  | 'field'

export type WidgetSpec = {
  type: WidgetType
  props?: Record<string, string | number | boolean>
  children?: WidgetSpec[]
  text?: string
}

export type WidgetParserOptions = {
  enforceNesting?: boolean
}
