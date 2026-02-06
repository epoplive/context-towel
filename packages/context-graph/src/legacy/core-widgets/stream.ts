import { parseWidgetMarkup } from './parser'
import type { WidgetSpec } from './types'

export type WidgetStreamState = {
  buffer: string
  nodes: WidgetSpec[]
  error?: Error | null
}

const isIncompleteError = (error: Error) =>
  /Unclosed widget tags|Mismatched closing tag/.test(error.message)

export const createWidgetStreamState = (): WidgetStreamState => ({
  buffer: '',
  nodes: [],
  error: null,
})

export const updateWidgetStream = (state: WidgetStreamState, chunk: string): WidgetStreamState => {
  const buffer = state.buffer + chunk
  try {
    const nodes = parseWidgetMarkup(buffer, { enforceNesting: true })
    return { buffer, nodes, error: null }
  } catch (err) {
    if (err instanceof Error && isIncompleteError(err)) {
      return { buffer, nodes: state.nodes, error: null }
    }
    return { buffer, nodes: state.nodes, error: err instanceof Error ? err : new Error(String(err)) }
  }
}
