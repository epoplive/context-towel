/**
 * Adapter: BlockDefinition → NodeTypeDefinition
 *
 * Converts existing card-library BlockDefinitions into the unified
 * NodeTypeDefinition format. This enables existing block types to
 * participate in the graph system without rewriting their components.
 *
 * During migration, blocks register in both systems. Once migration
 * is complete, the old BlockRegistry can be removed.
 */

import type { ComponentType } from 'react'
import type { BlockDefinition, BlockRenderProps, BlockInstance, BlockParseError, BlockUpdate } from '../blocks/types'
import type {
  NodeTypeDefinition,
  NodeCategory,
  NodeRenderProps,
  RenderContext,
  LayoutHints,
  DetectResult,
  ParseResult,
} from './types'

/**
 * Options for adapting a BlockDefinition
 */
export interface AdaptBlockOptions {
  /** Semantic category (defaults to 'content') */
  category?: NodeCategory
  /** Layout hints override */
  layoutHints?: Partial<LayoutHints>
  /** Which render contexts the block supports */
  supportedContexts?: RenderContext[]
  /** Detection function (blocks don't have this by default) */
  detect?: (content: string) => DetectResult
  /** Parse function (blocks don't have this by default) */
  parse?: (content: string, sourceFile: string) => ParseResult
  /** Priority for parse ordering */
  priority?: number
}

/**
 * Wrap a BlockRenderProps component to accept NodeRenderProps.
 * Maps the unified props format to the block's expected format.
 */
function wrapBlockComponent<T>(
  Component: ComponentType<BlockRenderProps<T>>,
): ComponentType<NodeRenderProps<T>> {
  const Wrapped = (props: NodeRenderProps<T>) => {
    const blockProps: BlockRenderProps<T> = {
      data: props.data,
      detail: props.detail,
      theme: props.theme,
      source: props.source,
      onEdit: props.onEdit,
      host: props.host,
      highlighter: props.highlighter,
    }
    return <Component {...blockProps} />
  }
  Wrapped.displayName = `Adapted(${Component.displayName ?? Component.name ?? 'Block'})`
  return Wrapped
}

/**
 * Convert a BlockDefinition to a NodeTypeDefinition.
 *
 * The block's components are wrapped to accept the unified NodeRenderProps.
 * Detection and parsing are optional — pass them in options if the block
 * should be parseable from markdown.
 */
export function adaptBlockToNodeType<T = unknown>(
  block: BlockDefinition<T>,
  options: AdaptBlockOptions = {},
): NodeTypeDefinition<T> {
  const {
    category = 'content',
    layoutHints,
    supportedContexts = ['inline', 'card'],
    detect,
    parse,
    priority,
  } = options

  // Wrap existing block components
  const components: NodeTypeDefinition<T>['components'] = {}
  if (block.components?.inline) {
    components.inline = wrapBlockComponent(block.components.inline)
  }
  if (block.components?.card) {
    components.card = wrapBlockComponent(block.components.card)
    // Card also serves as graph-node fallback
  }
  if (block.components?.node) {
    components['graph-node'] = wrapBlockComponent(block.components.node)
  }

  return {
    id: block.type,
    name: block.name,
    category,
    schemaVersion: block.schemaVersion,
    supportedContexts,
    components,
    capabilities: block.capabilities,
    layoutHints,
    detect,
    parse: parse as NodeTypeDefinition<T>['parse'],
    priority,
    validate: block.validate,
    toRuntime: block.toRuntime,
    toContextMarkdown: block.toContextMarkdown,
    serialize: block.serialize,
    applyUpdate: block.applyUpdate,
    skeleton: block.skeleton,
  }
}
