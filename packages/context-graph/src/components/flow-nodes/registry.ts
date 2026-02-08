import { createElement } from 'react'
import type { EdgeProps, EdgeTypes, NodeProps, NodeTypes } from '@xyflow/react'

import { ChecklistNode, type ChecklistNodeData } from '../../plugins/checklist/components'
import { DiagramNode, type DiagramNodeData } from '../../plugins/diagram/components'
import { TOCNode, type TOCNodeData } from '../../plugins/toc/components'
import { TaskNode, type TaskNodeData } from '../../plugins/task/components/nodes/TaskNode'
import { TaskListNode, type TaskListNodeData } from '../../plugins/task/components/nodes/TaskListNode'

import { DocumentNode, type DocumentNodeData } from './DocumentNode'
import { FileTreeNode, type FileTreeNodeData } from './FileTreeNode'
import { FloatingEdge } from './FloatingEdge'
import { FolderNode, type FolderNodeData } from './FolderNode'
import { LinkCardNode, type LinkCardNodeData } from './LinkCardNode'
import { WorkingDocNode, type WorkingDocNodeData } from './WorkingDocNode'

const FolderNodeAdapter = ({ data, selected }: NodeProps) => (
  createElement(FolderNode, { data: data as unknown as FolderNodeData, selected })
)

const DocumentNodeAdapter = ({ data, selected }: NodeProps) => (
  createElement(DocumentNode, { data: data as unknown as DocumentNodeData, selected })
)

const LinkCardNodeAdapter = ({ data, selected }: NodeProps) => (
  createElement(LinkCardNode, { data: data as unknown as LinkCardNodeData, selected })
)

const WorkingDocNodeAdapter = ({ data, selected }: NodeProps) => (
  createElement(WorkingDocNode, { data: data as unknown as WorkingDocNodeData, selected })
)

const TaskNodeAdapter = ({ data, selected }: NodeProps) => (
  createElement(TaskNode, { data: data as unknown as TaskNodeData, selected })
)

const TOCNodeAdapter = ({ data, selected }: NodeProps) => (
  createElement(TOCNode, { data: data as unknown as TOCNodeData, selected })
)

const TaskListNodeAdapter = ({ id, data, selected }: NodeProps) => (
  createElement(TaskListNode, { id, data: data as unknown as TaskListNodeData, selected })
)

const ChecklistNodeAdapter = ({ data, selected }: NodeProps) => (
  createElement(ChecklistNode, { data: data as unknown as ChecklistNodeData, selected })
)

const DiagramNodeAdapter = ({ data, selected }: NodeProps) => (
  createElement(DiagramNode, { data: data as unknown as DiagramNodeData, selected })
)

const FileTreeNodeAdapter = ({ data, selected }: NodeProps) => (
  createElement(FileTreeNode, { data: data as unknown as FileTreeNodeData, selected })
)

const FloatingEdgeAdapter = (props: EdgeProps) => createElement(FloatingEdge, props)

// Node type registry for React Flow
export const nodeTypes: NodeTypes = {
  folder: FolderNodeAdapter,
  document: DocumentNodeAdapter,
  'link-card': LinkCardNodeAdapter,
  workingdoc: WorkingDocNodeAdapter,
  task: TaskNodeAdapter,
  toc: TOCNodeAdapter,
  tasklist: TaskListNodeAdapter,
  checklist: ChecklistNodeAdapter,
  diagram: DiagramNodeAdapter,
  filetree: FileTreeNodeAdapter,
}

// Edge type registry for React Flow
export const edgeTypes: EdgeTypes = {
  floating: FloatingEdgeAdapter,
}
