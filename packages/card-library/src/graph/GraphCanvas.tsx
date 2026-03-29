/**
 * GraphCanvas — the core graph rendering component.
 *
 * Renders any graph type by composing:
 * - A GraphContextConfig (which node/edge types, layout, interactions)
 * - Node + edge data
 * - A GraphStore for state management
 *
 * Requires @xyflow/react as a peer dependency.
 *
 * Usage:
 *   <GraphCanvas
 *     config={DocsGraphContext}
 *     nodes={parsedNodes}
 *     edges={parsedEdges}
 *     onNodeClick={(id) => console.log('clicked', id)}
 *   />
 */

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from 'react'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  type Node as RFNode,
  type Edge as RFEdge,
  type OnNodesChange,
  type OnEdgesChange,
  type NodeMouseHandler,
  type Viewport,
  useNodesState,
  useEdgesState,
  useReactFlow,
} from '@xyflow/react'
import type { StoreApi } from 'zustand/vanilla'

import type { GraphContextConfig } from './types'
import { graphRegistry } from './GraphRegistry'
import type { GraphStoreState, GraphNode, GraphEdge } from './GraphStore'

// ─── Props ────────────────────────────────────────────────────────────────────

export interface GraphCanvasProps {
  /** Graph context configuration */
  config: GraphContextConfig
  /** Node data to render */
  nodes: GraphNode[]
  /** Edge data to render */
  edges: GraphEdge[]
  /** External store (optional — creates internal store if not provided) */
  store?: StoreApi<GraphStoreState>
  /** Callback when a node is clicked */
  onNodeClick?: (nodeId: string, nodeType: string) => void
  /** Callback when a node is double-clicked */
  onNodeDoubleClick?: (nodeId: string, nodeType: string) => void
  /** Callback when a node is right-clicked */
  onNodeContextMenu?: (nodeId: string, nodeType: string, x: number, y: number) => void
  /** Callback when viewport changes */
  onViewportChange?: (viewport: Viewport) => void
  /** Additional class name */
  className?: string
  /** Card scale factor */
  cardScale?: number
  /** Show grid background */
  showBackground?: boolean
}

// ─── Transform data to React Flow format ──────────────────────────────────────

function toRFNodes(nodes: GraphNode[], cardScale: number): RFNode[] {
  return nodes.map((n) => ({
    id: n.id,
    type: n.type,
    position: n.position,
    data: { ...n.data, cardScale },
    draggable: !n.pinned,
  }))
}

function toRFEdges(edges: GraphEdge[], config: GraphContextConfig): RFEdge[] {
  return edges.map((e) => {
    const edgeDef = graphRegistry.getEdgeType(e.edgeType)
    const style = edgeDef?.style ?? { stroke: '#4a5568', strokeWidth: 1 }

    return {
      id: e.id,
      source: e.source,
      target: e.target,
      type: edgeDef?.component ? e.edgeType : 'default',
      style: {
        stroke: style.stroke,
        strokeWidth: style.strokeWidth,
        strokeDasharray: style.strokeDasharray,
        opacity: style.opacity,
      },
      animated: style.animated,
      markerEnd: style.markerEnd ? 'url(#arrow)' : undefined,
      data: { edgeType: e.edgeType, ...e.data },
    }
  })
}

// ─── Component ────────────────────────────────────────────────────────────────

export const GraphCanvas = memo(function GraphCanvas({
  config,
  nodes: inputNodes,
  edges: inputEdges,
  onNodeClick,
  onNodeDoubleClick,
  onNodeContextMenu,
  onViewportChange,
  className,
  cardScale = 1.0,
  showBackground = true,
}: GraphCanvasProps) {
  // Build React Flow type maps from registry
  const nodeTypes = useMemo(() => graphRegistry.buildReactFlowNodeTypes(), [])
  const edgeTypes = useMemo(() => graphRegistry.buildReactFlowEdgeTypes(), [])

  // Transform to React Flow format
  const rfNodes = useMemo(() => toRFNodes(inputNodes, cardScale), [inputNodes, cardScale])
  const rfEdges = useMemo(() => toRFEdges(inputEdges, config), [inputEdges, config])

  // React Flow state
  const [nodes, setNodes, onNodesChange] = useNodesState(rfNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(rfEdges)

  // Sync external data changes
  const prevNodesRef = useRef(rfNodes)
  const prevEdgesRef = useRef(rfEdges)

  useEffect(() => {
    if (rfNodes !== prevNodesRef.current) {
      setNodes(rfNodes)
      prevNodesRef.current = rfNodes
    }
  }, [rfNodes, setNodes])

  useEffect(() => {
    if (rfEdges !== prevEdgesRef.current) {
      setEdges(rfEdges)
      prevEdgesRef.current = rfEdges
    }
  }, [rfEdges, setEdges])

  // Handlers
  const handleNodeClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      onNodeClick?.(node.id, node.type ?? '')
    },
    [onNodeClick],
  )

  const handleNodeDoubleClick: NodeMouseHandler = useCallback(
    (_event, node) => {
      onNodeDoubleClick?.(node.id, node.type ?? '')
    },
    [onNodeDoubleClick],
  )

  const handleNodeContextMenu: NodeMouseHandler = useCallback(
    (event, node) => {
      event.preventDefault()
      onNodeContextMenu?.(node.id, node.type ?? '', event.clientX, event.clientY)
    },
    [onNodeContextMenu],
  )

  const handleMoveEnd = useCallback(
    (_event: unknown, viewport: Viewport) => {
      onViewportChange?.(viewport)
    },
    [onViewportChange],
  )

  return (
    <ReactFlowProvider>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onNodeDoubleClick={handleNodeDoubleClick}
        onNodeContextMenu={handleNodeContextMenu}
        onMoveEnd={handleMoveEnd}
        panOnDrag={config.interactions.pan}
        zoomOnScroll={config.interactions.zoom}
        nodesDraggable={config.interactions.drag}
        nodesConnectable={false}
        fitView
        minZoom={0.1}
        maxZoom={3}
        className={className}
        proOptions={{ hideAttribution: true }}
      >
        {showBackground && <Background />}
      </ReactFlow>
    </ReactFlowProvider>
  )
})
