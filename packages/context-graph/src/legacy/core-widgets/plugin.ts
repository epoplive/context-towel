import type { ParserPlugin } from '../../compat/services'
import type { WidgetSpec } from './types'
import { detectWidgetMarkup, parseWidgetMarkup } from './parser'

export const widgetParserPlugin: ParserPlugin<WidgetSpec> = {
  id: 'widget',
  detect: detectWidgetMarkup,
  parse: (content, filePath) => {
    void filePath
    return {
      pluginId: 'widget',
      items: parseWidgetMarkup(content, { enforceNesting: true }),
      rawMatches: [
        {
          start: 0,
          end: content.length,
          startLine: 1,
          endLine: content.split('\n').length,
          content,
        },
      ],
    }
  },
  extensions: ['.md', '.markdown', '.mdx'],
}
