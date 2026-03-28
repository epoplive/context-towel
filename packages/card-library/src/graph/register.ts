/**
 * Built-in node type registration functions.
 *
 * Each function registers a set of existing block types as unified
 * NodeTypeDefinitions in the global GraphRegistry.
 */

import { graphRegistry } from './GraphRegistry'
import { adaptBlockToNodeType } from './adapt.js'
import { registerBuiltInEdgeTypes } from './edges'
import type { NodeTypeDefinition } from './types'

// Block definitions
import { taskBlockDefinition } from '../plugins/task'
import { checklistBlockDefinition } from '../plugins/checklist'
import { diagramBlockDefinition } from '../plugins/diagram'
import { tocBlockDefinition } from '../plugins/toc'
import { noteBlockDefinition } from '../plugins/note'
import { ruleBlockDefinition } from '../plugins/rule'
import { questionBlockDefinition } from '../plugins/question'
import { formBlockDefinition } from '../plugins/form'
import { commandResultBlockDefinition } from '../plugins/command-result'
import { fileContentBlockDefinition } from '../plugins/file-content'
import { fileDiffBlockDefinition } from '../plugins/file-diff'
import { fileListBlockDefinition } from '../plugins/file-list'
import { nodeBlockDefinition, nodeMapBlockDefinition } from '../plugins/node'
import { kanbanBlockDefinition } from '../plugins/kanban'
import { dependencyGraphBlockDefinition } from '../plugins/dependency-graph'
import { timelineBlockDefinition } from '../plugins/timeline'
import { indexBlockDefinition } from '../plugins/index'

/**
 * Register all content block types (task, checklist, diagram, note, etc.)
 * as unified NodeTypeDefinitions.
 */
export function registerContentNodeTypes(): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const contentTypes: NodeTypeDefinition<any>[] = [
    adaptBlockToNodeType(taskBlockDefinition, {
      category: 'content',
      layoutHints: { defaultWidth: 280, defaultHeight: 120, sizeCategory: 'standard', groupable: true, isContainer: false },
    }),
    adaptBlockToNodeType(checklistBlockDefinition, {
      category: 'content',
      layoutHints: { defaultWidth: 240, defaultHeight: 100, sizeCategory: 'compact', groupable: true, isContainer: false },
    }),
    adaptBlockToNodeType(diagramBlockDefinition, {
      category: 'content',
      layoutHints: { defaultWidth: 500, defaultHeight: 400, sizeCategory: 'large', groupable: false, isContainer: false },
    }),
    adaptBlockToNodeType(tocBlockDefinition, {
      category: 'content',
      layoutHints: { defaultWidth: 240, defaultHeight: 120, sizeCategory: 'standard', groupable: false, isContainer: false },
    }),
    adaptBlockToNodeType(noteBlockDefinition, {
      category: 'content',
      layoutHints: { defaultWidth: 240, defaultHeight: 80, sizeCategory: 'compact', groupable: false, isContainer: false },
    }),
    adaptBlockToNodeType(ruleBlockDefinition, { category: 'content' }),
    adaptBlockToNodeType(questionBlockDefinition, { category: 'content' }),
    adaptBlockToNodeType(formBlockDefinition, { category: 'content' }),
    adaptBlockToNodeType(commandResultBlockDefinition, { category: 'content' }),
    adaptBlockToNodeType(fileContentBlockDefinition, {
      category: 'reference',
      layoutHints: { defaultWidth: 320, defaultHeight: 200, sizeCategory: 'standard', groupable: false, isContainer: false },
    }),
    adaptBlockToNodeType(fileDiffBlockDefinition, {
      category: 'reference',
      layoutHints: { defaultWidth: 320, defaultHeight: 200, sizeCategory: 'standard', groupable: false, isContainer: false },
    }),
    adaptBlockToNodeType(fileListBlockDefinition, { category: 'reference' }),
    adaptBlockToNodeType(nodeBlockDefinition, { category: 'content' }),
    adaptBlockToNodeType(nodeMapBlockDefinition, { category: 'content' }),
    adaptBlockToNodeType(kanbanBlockDefinition, {
      category: 'content',
      layoutHints: { defaultWidth: 600, defaultHeight: 400, sizeCategory: 'large', groupable: false, isContainer: true },
    }),
    adaptBlockToNodeType(dependencyGraphBlockDefinition, {
      category: 'content',
      layoutHints: { defaultWidth: 600, defaultHeight: 400, sizeCategory: 'large', groupable: false, isContainer: false },
    }),
    adaptBlockToNodeType(timelineBlockDefinition, {
      category: 'temporal',
      layoutHints: { defaultWidth: 500, defaultHeight: 300, sizeCategory: 'large', groupable: false, isContainer: false },
    }),
    adaptBlockToNodeType(indexBlockDefinition, {
      category: 'reference',
      layoutHints: { defaultWidth: 300, defaultHeight: 200, sizeCategory: 'standard', groupable: false, isContainer: false },
    }),
  ]

  for (const def of contentTypes) {
    if (!graphRegistry.hasNodeType(def.id)) {
      graphRegistry.registerNodeType(def)
    }
  }
}

/**
 * Register all built-in types (content + edges).
 * Convenience function for apps that want everything.
 */
export function registerAllBuiltInTypes(): void {
  registerContentNodeTypes()
  registerBuiltInEdgeTypes()
}
