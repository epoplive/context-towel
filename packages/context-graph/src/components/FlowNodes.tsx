// React Flow custom node components (barrel)

export { FloatingEdge } from './flow-nodes/FloatingEdge'

export { FolderNode } from './flow-nodes/FolderNode'
export type { FolderNodeData } from './flow-nodes/FolderNode'

export { DocumentNode } from './flow-nodes/DocumentNode'
export type { DocumentNodeData } from './flow-nodes/DocumentNode'

export { LinkCardNode } from './flow-nodes/LinkCardNode'
export type { LinkCardStatus, LinkCardItem, LinkCardAction, LinkCardNodeData } from './flow-nodes/LinkCardNode'

export { WorkingDocNode } from './flow-nodes/WorkingDocNode'
export type { WorkingDocNodeData } from './flow-nodes/WorkingDocNode'

export { FileTreeNode } from './flow-nodes/FileTreeNode'
export type { FileTreeNodeData } from './flow-nodes/FileTreeNode'

export { nodeTypes, edgeTypes } from './flow-nodes/registry'

// Plugin node components and their types (backwards compatibility).
export {
  TaskNode,
  FullTaskNode,
  TaskListNode,
  ChecklistNode,
  DiagramNode,
  NodeNode,
  TOCNode,
} from '../plugins'

export type {
  TaskNodeData,
  FullTaskNodeData,
  TaskListNodeData,
  ChecklistNodeData,
  DiagramNodeData,
  NodeNodeData,
  TOCNodeData,
  TOCSectionItem,
} from '../plugins'

// Packet-specific node types
export { VectorNode } from './packet/VectorNode'
export type { VectorNodeData } from './packet/VectorNode'
export { DeltaTimelineNode } from './packet/DeltaTimelineNode'
export type { DeltaTimelineNodeData } from './packet/DeltaTimelineNode'
export { CriterionNode } from './packet/CriterionNode'
export type { CriterionNodeData, CriterionState } from './packet/CriterionNode'
export { GapNode } from './packet/GapNode'
export type { GapNodeData } from './packet/GapNode'

