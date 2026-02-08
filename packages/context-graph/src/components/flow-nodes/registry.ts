import { TaskNode, TaskListNode, ChecklistNode, DiagramNode, TOCNode } from '../../plugins'

import { DocumentNode } from './DocumentNode'
import { FileTreeNode } from './FileTreeNode'
import { FloatingEdge } from './FloatingEdge'
import { FolderNode } from './FolderNode'
import { LinkCardNode } from './LinkCardNode'
import { WorkingDocNode } from './WorkingDocNode'

// Node type registry for React Flow
export const nodeTypes = {
  folder: FolderNode,
  document: DocumentNode,
  'link-card': LinkCardNode,
  workingdoc: WorkingDocNode,
  task: TaskNode,
  toc: TOCNode,
  tasklist: TaskListNode,
  checklist: ChecklistNode,
  diagram: DiagramNode,
  filetree: FileTreeNode,
}

// Edge type registry for React Flow
export const edgeTypes = {
  floating: FloatingEdge,
}

