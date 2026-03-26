import { createElement } from 'react'
import type { EdgeProps, EdgeTypes, NodeProps, NodeTypes } from '@xyflow/react'

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

// Packet-specific node components
import { VectorNode, type VectorNodeData } from '../packet/VectorNode'
import { GapNode, type GapNodeData } from '../packet/GapNode'
import { DeltaTimelineNode, type DeltaTimelineNodeData } from '../packet/DeltaTimelineNode'
import { CriterionNode, type CriterionNodeData } from '../packet/CriterionNode'
import { ReferenceNode, type ReferenceNodeData } from '../packet/ReferenceNode'
import { TestNode, type TestNodeData } from '../packet/TestNode'
import { PacketDiagramNode, type PacketDiagramNodeData } from '../packet/PacketDiagramNode'

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

const NodeNodeAdapter = ({ data, selected }: NodeProps) => (
  createElement(NodeNode, { data: data as unknown as NodeNodeData, selected })
)

const FileTreeNodeAdapter = ({ data, selected }: NodeProps) => (
  createElement(FileTreeNode, { data: data as unknown as FileTreeNodeData, selected })
)

const IndexEntityNodeAdapter = ({ data, selected }: NodeProps) => (
  createElement(IndexEntityNode, { data: data as unknown as IndexEntityNodeData, selected })
)

// Packet node adapters
const VectorNodeAdapter = ({ data, selected }: NodeProps) => (
  createElement(VectorNode, { data: data as unknown as VectorNodeData, selected })
)

const GapNodeAdapter = ({ data, selected }: NodeProps) => (
  createElement(GapNode, { data: data as unknown as GapNodeData, selected })
)

const DeltaTimelineNodeAdapter = ({ data, selected }: NodeProps) => (
  createElement(DeltaTimelineNode, { data: data as unknown as DeltaTimelineNodeData, selected })
)

const CriterionNodeAdapter = ({ data, selected }: NodeProps) => (
  createElement(CriterionNode, { data: data as unknown as CriterionNodeData, selected })
)

const ReferenceNodeAdapter = ({ data, selected }: NodeProps) => (
  createElement(ReferenceNode, { data: data as unknown as ReferenceNodeData, selected })
)

const TestNodeAdapter = ({ data, selected }: NodeProps) => (
  createElement(TestNode, { data: data as unknown as TestNodeData, selected })
)

const PacketDiagramNodeAdapter = ({ data, selected }: NodeProps) => (
  createElement(PacketDiagramNode, { data: data as unknown as PacketDiagramNodeData, selected })
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
  node: NodeNodeAdapter,
  filetree: FileTreeNodeAdapter,
  'entity-index': IndexEntityNodeAdapter,
  // Packet-specific node types
  vector: VectorNodeAdapter,
  gap: GapNodeAdapter,
  'delta-timeline': DeltaTimelineNodeAdapter,
  criterion: CriterionNodeAdapter,
  'reference-pill': ReferenceNodeAdapter,
  'test-pill': TestNodeAdapter,
  'packet-diagram': PacketDiagramNodeAdapter,
}

// Edge type registry for React Flow
export const edgeTypes: EdgeTypes = {
  floating: FloatingEdgeAdapter,
}
