import { memo } from 'react'
import { type EdgeProps, Position, useInternalNode, getSmoothStepPath } from '@xyflow/react'

// Get best connection side for a node relative to another node
function getBestConnectionSide(
  nodeRect: { x: number; y: number; width: number; height: number },
  targetCenter: { x: number; y: number }
): { point: { x: number; y: number }; position: Position } {
  const centerX = nodeRect.x + nodeRect.width / 2
  const centerY = nodeRect.y + nodeRect.height / 2

  const dx = targetCenter.x - centerX
  const dy = targetCenter.y - centerY
  const absDx = Math.abs(dx)
  const absDy = Math.abs(dy)

  // Use aspect ratio to determine best connection side
  // For very horizontal relationships, prefer left/right
  // For very vertical relationships, prefer top/bottom
  const aspectRatio = nodeRect.width / nodeRect.height
  const directionRatio = absDx / (absDy || 1)

  // Calculate padding from edge (connect 10px inside the boundary for cleaner lines)
  const edgePadding = 0

  if (directionRatio > aspectRatio * 0.5) {
    // More horizontal - use left or right
    if (dx > 0) {
      return {
        point: { x: nodeRect.x + nodeRect.width - edgePadding, y: centerY },
        position: Position.Right,
      }
    } else {
      return {
        point: { x: nodeRect.x + edgePadding, y: centerY },
        position: Position.Left,
      }
    }
  } else {
    // More vertical - use top or bottom
    if (dy > 0) {
      return {
        point: { x: centerX, y: nodeRect.y + nodeRect.height - edgePadding },
        position: Position.Bottom,
      }
    } else {
      return {
        point: { x: centerX, y: nodeRect.y + edgePadding },
        position: Position.Top,
      }
    }
  }
}

// Custom floating edge component with improved connection point algorithm
export const FloatingEdge = memo(({
  id,
  source,
  target,
  style,
  markerEnd,
}: EdgeProps) => {
  const sourceNode = useInternalNode(source)
  const targetNode = useInternalNode(target)

  // Defensive checks - nodes or their internals can be undefined during drag operations
  if (!sourceNode || !targetNode) {
    return null
  }

  // Check for valid position data - can be undefined during state transitions
  const sourcePos = sourceNode.internals?.positionAbsolute
  const targetPos = targetNode.internals?.positionAbsolute
  if (!sourcePos || !targetPos) {
    return null
  }

  // Get node dimensions - use measured dimensions from React Flow
  const sourceWidth = sourceNode.measured?.width ?? sourceNode.width ?? 100
  const sourceHeight = sourceNode.measured?.height ?? sourceNode.height ?? 40
  const targetWidth = targetNode.measured?.width ?? targetNode.width ?? 100
  const targetHeight = targetNode.measured?.height ?? targetNode.height ?? 40

  // Get cardScale from node data (applied via CSS transform)
  const sourceScale = (sourceNode.data as any)?.cardScale ?? 1.0
  const targetScale = (targetNode.data as any)?.cardScale ?? 1.0

  // Adjust dimensions for scale (CSS transform: scale affects visual size but not measured)
  const scaledSourceWidth = sourceWidth * sourceScale
  const scaledSourceHeight = sourceHeight * sourceScale
  const scaledTargetWidth = targetWidth * targetScale
  const scaledTargetHeight = targetHeight * targetScale

  const sourceRect = {
    x: sourcePos.x,
    y: sourcePos.y,
    width: scaledSourceWidth,
    height: scaledSourceHeight,
  }

  const targetRect = {
    x: targetPos.x,
    y: targetPos.y,
    width: scaledTargetWidth,
    height: scaledTargetHeight,
  }

  // Get center points (accounting for scaled size)
  const sourceCenter = {
    x: sourceRect.x + scaledSourceWidth / 2,
    y: sourceRect.y + scaledSourceHeight / 2,
  }
  const targetCenter = {
    x: targetRect.x + scaledTargetWidth / 2,
    y: targetRect.y + scaledTargetHeight / 2,
  }

  // Get best connection points on each node's boundary
  const sourceConnection = getBestConnectionSide(sourceRect, targetCenter)
  const targetConnection = getBestConnectionSide(targetRect, sourceCenter)

  // Generate smooth step path with better border radius
  const [edgePath] = getSmoothStepPath({
    sourceX: sourceConnection.point.x,
    sourceY: sourceConnection.point.y,
    sourcePosition: sourceConnection.position,
    targetX: targetConnection.point.x,
    targetY: targetConnection.point.y,
    targetPosition: targetConnection.position,
    borderRadius: 12,
  })

  return (
    <path
      id={id}
      className="react-flow__edge-path"
      d={edgePath}
      style={style}
      markerEnd={markerEnd}
    />
  )
})

