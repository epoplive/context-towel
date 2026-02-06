import { unified } from 'unified'
import remarkParse from 'remark-parse'
import { visit } from 'unist-util-visit'
import type { Code } from 'mdast'
import type { BlockInstance, BlockParseError } from './types'
import { blockRegistry } from './registry'
import { validateBlockYaml } from './validation'

type MarkdownBlockParseResult = {
  blocks: BlockInstance[]
  errors: BlockParseError[]
}

function sliceRawBlock(content: string, node: Code): string {
  const start = node.position?.start?.offset
  const end = node.position?.end?.offset
  if (typeof start === 'number' && typeof end === 'number') {
    return content.slice(start, end)
  }
  return node.value
}

export function parseMarkdownBlocks(content: string, filePath: string): MarkdownBlockParseResult {
  const blocks: BlockInstance[] = []
  const errors: BlockParseError[] = []

  const tree = unified().use(remarkParse).parse(content)

  visit(tree, 'code', (node: Code) => {
    const type = node.lang?.trim()
    if (!type || !blockRegistry.has(type)) return

    const raw = sliceRawBlock(content, node)
    const { data, errors: blockErrors } = validateBlockYaml(type, node.value ?? '')

    blocks.push({
      type,
      data,
      source: {
        filePath,
        range: {
          startOffset: node.position?.start?.offset ?? null,
          endOffset: node.position?.end?.offset ?? null,
          startLine: node.position?.start?.line ?? null,
          endLine: node.position?.end?.line ?? null,
        },
        raw,
      },
      errors: blockErrors.length > 0 ? blockErrors : undefined,
    })

    if (blockErrors.length > 0) {
      errors.push(...blockErrors)
    }
  })

  return { blocks, errors }
}
