import type { Node } from '@xyflow/react'
import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import { useCallback } from 'react'

import { useGraphShortcuts } from '../../compat/keybindings'

export interface UseGraphNavigationArgs {
  reactFlowInstance: MutableRefObject<any>
  quickPreviewNode: string | null
  nodes: Node[]
  setNodes: Dispatch<SetStateAction<Node[]>>
  keyboardSelectedIndex: number
  setKeyboardSelectedIndex: Dispatch<SetStateAction<number>>
  isZoomedToNode: boolean
  setIsZoomedToNode: Dispatch<SetStateAction<boolean>>
  increaseCardScale: () => void
  decreaseCardScale: () => void
}

export function useGraphNavigation({
  reactFlowInstance,
  quickPreviewNode,
  nodes,
  setNodes,
  keyboardSelectedIndex,
  setKeyboardSelectedIndex,
  isZoomedToNode,
  setIsZoomedToNode,
  increaseCardScale,
  decreaseCardScale,
}: UseGraphNavigationArgs) {
  // Graph keyboard shortcuts via keybindings system
  const PAN_STEP = 50
  const FAST_PAN_STEP = 200

  const panGraph = useCallback((dx: number, dy: number) => {
    const instance = reactFlowInstance.current
    if (!instance || quickPreviewNode) return
    const viewport = instance.getViewport()
    instance.setViewport({ x: viewport.x + dx, y: viewport.y + dy, zoom: viewport.zoom }, { duration: 100 })
  }, [quickPreviewNode])

  const zoomGraph = useCallback((delta: number) => {
    const instance = reactFlowInstance.current
    if (!instance) return
    const viewport = instance.getViewport()
    const newZoom = Math.min(Math.max(viewport.zoom + delta, 0.1), 2)
    instance.setViewport({ x: viewport.x, y: viewport.y, zoom: newZoom }, { duration: 100 })
  }, [])

  // Navigate to next node with Tab
  const selectNextNode = useCallback(() => {
    if (nodes.length === 0) return
    const nextIndex = keyboardSelectedIndex < 0 ? 0 : (keyboardSelectedIndex + 1) % nodes.length
    setKeyboardSelectedIndex(nextIndex)
    setIsZoomedToNode(false)

    // Select the node in ReactFlow
    const nodeId = nodes[nextIndex].id
    setNodes(nds => nds.map(n => ({ ...n, selected: n.id === nodeId })))

    // Pan to center the node
    const node = nodes[nextIndex]
    if (node && reactFlowInstance.current) {
      reactFlowInstance.current.setCenter(
        node.position.x + 150,
        node.position.y + 50,
        { duration: 200, zoom: reactFlowInstance.current.getViewport().zoom }
      )
    }
  }, [nodes, keyboardSelectedIndex, setNodes])

  // Navigate to previous node with Shift+Tab
  const selectPrevNode = useCallback(() => {
    if (nodes.length === 0) return
    const prevIndex = keyboardSelectedIndex <= 0 ? nodes.length - 1 : keyboardSelectedIndex - 1
    setKeyboardSelectedIndex(prevIndex)
    setIsZoomedToNode(false)

    // Select the node in ReactFlow
    const nodeId = nodes[prevIndex].id
    setNodes(nds => nds.map(n => ({ ...n, selected: n.id === nodeId })))

    // Pan to center the node
    const node = nodes[prevIndex]
    if (node && reactFlowInstance.current) {
      reactFlowInstance.current.setCenter(
        node.position.x + 150,
        node.position.y + 50,
        { duration: 200, zoom: reactFlowInstance.current.getViewport().zoom }
      )
    }
  }, [nodes, keyboardSelectedIndex, setNodes])

  // Zoom to selected node or zoom back to fit all
  const zoomToSelectedNode = useCallback(() => {
    const instance = reactFlowInstance.current
    if (!instance) return

    if (isZoomedToNode) {
      // Zoom back to fit all
      instance.fitView({ padding: 0.2, duration: 300 })
      setIsZoomedToNode(false)
    } else if (keyboardSelectedIndex >= 0 && keyboardSelectedIndex < nodes.length) {
      // Zoom to the selected node
      const node = nodes[keyboardSelectedIndex]
      instance.fitView({ nodes: [node], padding: 0.3, duration: 300 })
      setIsZoomedToNode(true)
    } else {
      // No node selected, just fit all
      instance.fitView({ padding: 0.2, duration: 300 })
    }
  }, [nodes, keyboardSelectedIndex, isZoomedToNode])

  // Register graph keyboard shortcuts (host app provides the implementation via compat config).
  useGraphShortcuts({
    panUp: () => panGraph(0, PAN_STEP),
    panDown: () => panGraph(0, -PAN_STEP),
    panLeft: () => panGraph(PAN_STEP, 0),
    panRight: () => panGraph(-PAN_STEP, 0),
    fastPanUp: () => panGraph(0, FAST_PAN_STEP),
    fastPanDown: () => panGraph(0, -FAST_PAN_STEP),
    fastPanLeft: () => panGraph(FAST_PAN_STEP, 0),
    fastPanRight: () => panGraph(-FAST_PAN_STEP, 0),
    zoomIn: () => zoomGraph(0.15),
    zoomOut: () => zoomGraph(-0.15),
    fitView: () => reactFlowInstance.current?.fitView({ padding: 0.2, duration: 200 }),
    increaseCardScale,
    decreaseCardScale,
    nextNode: selectNextNode,
    prevNode: selectPrevNode,
    zoomToNode: zoomToSelectedNode,
  })
}

