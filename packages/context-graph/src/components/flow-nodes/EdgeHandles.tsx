import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'

// All 4 edge handles - React Flow will pick the best one based on node positions
export const EdgeHandles = memo(({ color }: { color: string }) => (
  <>
    <Handle type="target" id="top" position={Position.Top} style={{ background: color }} />
    <Handle type="target" id="left" position={Position.Left} style={{ background: color }} />
    <Handle type="target" id="right" position={Position.Right} style={{ background: color }} />
    <Handle type="target" id="bottom" position={Position.Bottom} style={{ background: color }} />
    <Handle type="source" id="source-top" position={Position.Top} style={{ background: color }} />
    <Handle type="source" id="source-left" position={Position.Left} style={{ background: color }} />
    <Handle type="source" id="source-right" position={Position.Right} style={{ background: color }} />
    <Handle type="source" id="source-bottom" position={Position.Bottom} style={{ background: color }} />
  </>
))

