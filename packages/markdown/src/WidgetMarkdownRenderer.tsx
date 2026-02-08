import { MarkdownRenderer, type MarkdownRendererProps } from './MarkdownRenderer'

export type WidgetMarkdownRendererProps = MarkdownRendererProps

/**
 * Legacy alias: historically we supported an MDX-like `<Card>...</Card>` tag
 * language. The canonical format is fenced YAML blocks (```task, ```form, etc),
 * so this now simply renders markdown + typed blocks.
 */
export function WidgetMarkdownRenderer(props: WidgetMarkdownRendererProps) {
  return <MarkdownRenderer {...props} />
}
