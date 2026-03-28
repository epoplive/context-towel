/**
 * Packet workspace node type definitions.
 *
 * These define the node types used in packet graph contexts (vector, gap,
 * delta-timeline, criterion, reference-pill, test-pill, packet-diagram).
 *
 * The actual React components still live in context-graph for now.
 * Registration functions accept component references so context-graph
 * can pass its existing components in.
 *
 * Layout hints and categories are defined here in the shared library
 * so any consumer can create a packet graph context.
 */

import type { ComponentType } from 'react'
import type { NodeTypeDefinition, NodeRenderProps } from './types'
import { graphRegistry } from './GraphRegistry'

/** Packet node type metadata (no components — those come from the consumer) */
export interface PacketNodeTypeStub {
  id: string
  name: string
  category: NodeTypeDefinition['category']
  layoutHints: NonNullable<NodeTypeDefinition['layoutHints']>
}

export const packetNodeStubs: PacketNodeTypeStub[] = [
  {
    id: 'vector',
    name: 'Problem Vector',
    category: 'metric',
    layoutHints: {
      defaultWidth: 300,
      defaultHeight: 200,
      sizeCategory: 'standard',
      groupable: false,
      isContainer: false,
    },
  },
  {
    id: 'gap',
    name: 'Work Node',
    category: 'content',
    layoutHints: {
      defaultWidth: 240,
      defaultHeight: 140,
      sizeCategory: 'standard',
      groupable: true,
      isContainer: false,
    },
  },
  {
    id: 'delta-timeline',
    name: 'Delta Timeline',
    category: 'temporal',
    layoutHints: {
      defaultWidth: 260,
      defaultHeight: 180,
      sizeCategory: 'standard',
      groupable: false,
      isContainer: false,
    },
  },
  {
    id: 'criterion',
    name: 'Criterion',
    category: 'metric',
    layoutHints: {
      defaultWidth: 160,
      defaultHeight: 36,
      sizeCategory: 'pill',
      groupable: true,
      isContainer: false,
    },
  },
  {
    id: 'reference-pill',
    name: 'Reference',
    category: 'reference',
    layoutHints: {
      defaultWidth: 160,
      defaultHeight: 36,
      sizeCategory: 'pill',
      groupable: true,
      isContainer: false,
    },
  },
  {
    id: 'test-pill',
    name: 'Test',
    category: 'reference',
    layoutHints: {
      defaultWidth: 160,
      defaultHeight: 36,
      sizeCategory: 'pill',
      groupable: true,
      isContainer: false,
    },
  },
  {
    id: 'packet-diagram',
    name: 'Packet Diagram',
    category: 'content',
    layoutHints: {
      defaultWidth: 400,
      defaultHeight: 300,
      sizeCategory: 'large',
      groupable: false,
      isContainer: false,
    },
  },
]

/**
 * Register packet node types with their React components.
 *
 * Call this from context-graph (or any consumer) passing in the actual
 * component implementations:
 *
 *   registerPacketNodeTypes({
 *     vector: VectorNode,
 *     gap: GapNode,
 *     ...
 *   })
 */
export function registerPacketNodeTypes(
  components: Partial<Record<string, ComponentType<NodeRenderProps>>>,
): void {
  for (const stub of packetNodeStubs) {
    if (graphRegistry.hasNodeType(stub.id)) continue

    const comp = components[stub.id]

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const def: NodeTypeDefinition<any> = {
      id: stub.id,
      name: stub.name,
      category: stub.category,
      supportedContexts: comp ? ['graph-node', 'card'] : [],
      components: comp
        ? { 'graph-node': comp, card: comp }
        : {},
      layoutHints: stub.layoutHints,
    }

    graphRegistry.registerNodeType(def)
  }
}

/**
 * Register packet node types with stubs only (no components).
 * Useful for headless/test contexts that need the type metadata
 * without rendering.
 */
export function registerPacketNodeTypeStubs(): void {
  registerPacketNodeTypes({})
}
