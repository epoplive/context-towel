import type { WidgetParserOptions, WidgetSpec, WidgetType } from './types'

const TAG_MAP: Record<string, WidgetType> = {
  Card: 'card',
  Grid: 'grid',
  Text: 'text',
  List: 'list',
  Form: 'form',
  Table: 'table',
  Row: 'row',
  Column: 'column',
  Item: 'item',
  Field: 'field',
}

const ALLOWED_CHILDREN: Record<WidgetType, WidgetType[]> = {
  card: ['grid', 'text', 'list', 'table', 'form', 'row', 'column', 'item', 'field'],
  grid: ['card', 'text', 'list', 'table', 'form', 'row', 'column', 'item', 'field'],
  text: [],
  list: ['item', 'text'],
  table: ['row'],
  row: ['column', 'text'],
  column: ['text', 'card', 'list', 'table', 'form'],
  form: ['field', 'text'],
  item: ['text', 'card', 'list', 'table', 'form'],
  field: ['text'],
}

const parseAttributes = (input: string): Record<string, string | number | boolean> => {
  const props: Record<string, string | number | boolean> = {}
  const attrRegex = /([a-zA-Z][a-zA-Z0-9_-]*)\s*=\s*(\"[^\"]*\"|'[^']*')/g
  let match: RegExpExecArray | null
  while ((match = attrRegex.exec(input)) !== null) {
    const key = match[1]
    let value = match[2].slice(1, -1)
    if (value === 'true') {
      props[key] = true
    } else if (value === 'false') {
      props[key] = false
    } else if (!Number.isNaN(Number(value)) && value.trim() !== '') {
      props[key] = Number(value)
    } else {
      props[key] = value
    }
  }
  return props
}

const buildTextNode = (text: string): WidgetSpec | null => {
  const trimmed = text.replace(/\s+/g, ' ').trim()
  if (!trimmed) return null
  return { type: 'text', text: trimmed }
}

const validateNode = (node: WidgetSpec): void => {
  if (!node.children || node.children.length === 0) return
  const allowed = ALLOWED_CHILDREN[node.type] ?? []
  node.children.forEach((child) => {
    if (child.type === 'text') return
    if (!allowed.includes(child.type)) {
      throw new Error(`Invalid widget nesting: ${node.type} cannot contain ${child.type}`)
    }
    validateNode(child)
  })
}

export const parseWidgetMarkup = (input: string, options: WidgetParserOptions = {}): WidgetSpec[] => {
  const root: WidgetSpec = { type: 'grid', children: [] }
  const stack: WidgetSpec[] = [root]
  const tagRegex = /<\/?([A-Za-z][A-Za-z0-9]*)\b([^>]*?)\/?>/g
  let cursor = 0
  let match: RegExpExecArray | null

  while ((match = tagRegex.exec(input)) !== null) {
    const [raw, tagName, rawAttrs] = match
    const isClosing = raw.startsWith('</')
    const isSelfClosing = raw.endsWith('/>')
    const mapped = TAG_MAP[tagName]

    if (!mapped) {
      throw new Error(`Unsupported widget tag: ${tagName}`)
    }

    const textChunk = input.slice(cursor, match.index)
    const textNode = buildTextNode(textChunk)
    if (textNode) {
      stack[stack.length - 1].children?.push(textNode)
    }

    if (isClosing) {
      const last = stack.pop()
      if (!last || last.type !== mapped) {
        throw new Error(`Mismatched closing tag: ${tagName}`)
      }
    } else {
      const node: WidgetSpec = {
        type: mapped,
        props: Object.keys(parseAttributes(rawAttrs)).length > 0 ? parseAttributes(rawAttrs) : undefined,
        children: [],
      }
      stack[stack.length - 1].children?.push(node)
      if (!isSelfClosing) {
        stack.push(node)
      }
    }

    cursor = match.index + raw.length
  }

  const tail = buildTextNode(input.slice(cursor))
  if (tail) {
    stack[stack.length - 1].children?.push(tail)
  }

  if (stack.length !== 1) {
    throw new Error('Unclosed widget tags detected')
  }

  const nodes = root.children ?? []
  if (options.enforceNesting) {
    nodes.forEach(validateNode)
  }
  return nodes
}

export const validateWidgetTree = (nodes: WidgetSpec[]): void => {
  nodes.forEach(validateNode)
}

export const detectWidgetMarkup = (content: string): boolean => {
  return /<(Card|Grid|Text|List|Form|Table|Row|Column|Item|Field)\b/.test(content)
}
