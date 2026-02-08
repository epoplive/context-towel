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
  TOCNode,
} from '../plugins'

export type {
  TaskNodeData,
  FullTaskNodeData,
  TaskListNodeData,
  ChecklistNodeData,
  DiagramNodeData,
  TOCNodeData,
  TOCSectionItem,
} from '../plugins'

