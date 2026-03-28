/**
 * Node and edge type registry — powered by card-library's unified GraphRegistry.
 *
 * All node types register once into graphRegistry. The exported nodeTypes/edgeTypes
 * maps are built from the registry, so any consumer (DocumentGraph, PacketWorkspace)
 * gets the same set.
 */

import { createElement } from 'react'
import type { EdgeProps, EdgeTypes, NodeProps, NodeTypes } from '@xyflow/react'
import {
  graphRegistry,
  registerContentNodeTypes,
  registerPacketNodeTypes,
  registerBuiltInEdgeTypes,
} from '@context-towel/card-library'

// ─── Document/structural node components ──────────────────────────────────────
import { ChecklistNode, type ChecklistNodeData } from '../../plugins/checklist/components'
import { DiagramNode, type DiagramNodeData } from '../../plugins/diagram/components'
import { NodeNode, type NodeNodeData } from '../../plugins/node/components'
import { TOCNode, type TOCNodeData } from '../../plugins/toc/components'
import { TaskNode, type TaskNodeData } from '../../plugins/task/components/nodes/TaskNode'
import { TaskListNode, type TaskListNodeData } from '../../plugins/task/components/nodes/TaskListNode'
import { IndexEntityNode, type IndexEntityNodeData } from '../../plugins/entity-index/components'
import { DocumentNode, type DocumentNodeData } from './DocumentNode'
import { FileTreeNode, type FileTreeNodeData } from './FileTreeNode'
import { FloatingEdge } from './FloatingEdge'
import { FolderNode, type FolderNodeData } from './FolderNode'
import { LinkCardNode, type LinkCardNodeData } from './LinkCardNode'
import { WorkingDocNode, type WorkingDocNodeData } from './WorkingDocNode'

// ─── Packet node components ──────────────────────────────────────────────────
import { VectorNode, type VectorNodeData } from '../packet/VectorNode'
import { GapNode, type GapNodeData } from '../packet/GapNode'
import { DeltaTimelineNode, type DeltaTimelineNodeData } from '../packet/DeltaTimelineNode'
import { CriterionNode, type CriterionNodeData } from '../packet/CriterionNode'
import { ReferenceNode, type ReferenceNodeData } from '../packet/ReferenceNode'
import { TestNode, type TestNodeData } from '../packet/TestNode'
import { PacketDiagramNode, type PacketDiagramNodeData } from '../packet/PacketDiagramNode'

// ─── Adapters (NodeProps → component-specific data) ───────────────────────────

const adapt = <T,>(Component: any, mapData?: (data: any, props: NodeProps) => any) =>
  (props: NodeProps) => createElement(Component, {
    data: props.data as unknown as T,
    selected: props.selected,
    ...(mapData ? mapData(props.data, props) : {}),
  })

// Structural node adapters
const structuralAdapters: Record<string, (props: NodeProps) => any> = {
  folder: adapt<FolderNodeData>(FolderNode),
  document: adapt<DocumentNodeData>(DocumentNode),
  'link-card': adapt<LinkCardNodeData>(LinkCardNode),
  workingdoc: adapt<WorkingDocNodeData>(WorkingDocNode),
  filetree: adapt<FileTreeNodeData>(FileTreeNode),
}

// Plugin node adapters (these have graph-specific node components in context-graph)
const pluginAdapters: Record<string, (props: NodeProps) => any> = {
  task: adapt<TaskNodeData>(TaskNode),
  toc: adapt<TOCNodeData>(TOCNode),
  tasklist: (props: NodeProps) => createElement(TaskListNode, {
    id: props.id,
    data: props.data as unknown as TaskListNodeData,
    selected: props.selected,
  }),
  checklist: adapt<ChecklistNodeData>(ChecklistNode),
  diagram: adapt<DiagramNodeData>(DiagramNode),
  node: adapt<NodeNodeData>(NodeNode),
  'entity-index': adapt<IndexEntityNodeData>(IndexEntityNode),
}

// Packet node adapters
const packetAdapters: Record<string, (props: NodeProps) => any> = {
  vector: adapt<VectorNodeData>(VectorNode),
  gap: adapt<GapNodeData>(GapNode),
  'delta-timeline': adapt<DeltaTimelineNodeData>(DeltaTimelineNode),
  criterion: adapt<CriterionNodeData>(CriterionNode),
  'reference-pill': adapt<ReferenceNodeData>(ReferenceNode),
  'test-pill': adapt<TestNodeData>(TestNode),
  'packet-diagram': adapt<PacketDiagramNodeData>(PacketDiagramNode),
}

// ─── Registration ─────────────────────────────────────────────────────────────

let _initialized = false

function ensureRegistered(): void {
  if (_initialized) return
  _initialized = true

  // Register card-library content types (task, checklist, diagram blocks etc.)
  registerContentNodeTypes()

  // Register built-in edge types
  registerBuiltInEdgeTypes()

  // Register structural node types (context-graph specific — folder, document, etc.)
  for (const [id, adapter] of Object.entries(structuralAdapters)) {
    if (!graphRegistry.hasNodeType(id)) {
      graphRegistry.registerNodeType({
        id,
        name: id,
        category: 'structural',
        supportedContexts: ['graph-node'],
        components: { 'graph-node': adapter as any },
      })
    }
  }

  // Override plugin node types with context-graph's graph-specific components
  // (card-library registered card components; context-graph has better graph nodes)
  for (const [id, adapter] of Object.entries(pluginAdapters)) {
    graphRegistry.registerOrReplaceNodeType({
      id,
      name: id,
      category: 'content',
      supportedContexts: ['graph-node', 'card', 'inline'],
      components: {
        'graph-node': adapter as any,
        // card/inline fall through to card-library's components via the registry
      },
    })
  }

  // Register packet node types with their components
  registerPacketNodeTypes(packetAdapters as any)

  // Register floating edge with its component
  graphRegistry.registerOrReplaceEdgeType({
    id: 'floating',
    name: 'Floating',
    style: { stroke: '#4a5568', strokeWidth: 1.5 },
    component: ((props: EdgeProps) => createElement(FloatingEdge, props)) as any,
  })
}

// ─── Exports (backward compatible) ────────────────────────────────────────────

// Ensure registration happens on first import
ensureRegistered()

/**
 * Node types map for React Flow — built from the unified GraphRegistry.
 * This replaces the old static map.
 */
export const nodeTypes: NodeTypes = graphRegistry.buildReactFlowNodeTypes() as NodeTypes

/**
 * Edge types map for React Flow — built from the unified GraphRegistry.
 */
export const edgeTypes: EdgeTypes = graphRegistry.buildReactFlowEdgeTypes() as EdgeTypes
