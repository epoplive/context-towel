/**
 * Simple collision resolution - push overlapping nodes apart
 */
export function resolveCollisions(
  positioned: Map<string, { x: number; y: number }>,
  nodeSizeMap: Map<string, { width: number; height: number }>,
  iterations = 15
): void {
  const ids = Array.from(positioned.keys())
  const padding = 15

  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const idA = ids[i]
        const idB = ids[j]
        const posA = positioned.get(idA)!
        const posB = positioned.get(idB)!
        const sizeA = nodeSizeMap.get(idA) || { width: 200, height: 100 }
        const sizeB = nodeSizeMap.get(idB) || { width: 200, height: 100 }

        // Positions are TOP-LEFT corners in ReactFlow
        // Check if rectangles overlap (with padding)
        const aLeft = posA.x - padding
        const aRight = posA.x + sizeA.width + padding
        const aTop = posA.y - padding
        const aBottom = posA.y + sizeA.height + padding

        const bLeft = posB.x
        const bRight = posB.x + sizeB.width
        const bTop = posB.y
        const bBottom = posB.y + sizeB.height

        // Check overlap
        const overlapX = Math.min(aRight, bRight) - Math.max(aLeft, bLeft)
        const overlapY = Math.min(aBottom, bBottom) - Math.max(aTop, bTop)

        if (overlapX > 0 && overlapY > 0) {
          // Push apart along the axis with less overlap
          const pushX = overlapX / 2 + 5
          const pushY = overlapY / 2 + 5

          if (overlapX < overlapY) {
            // Push horizontally
            if (posA.x < posB.x) {
              posA.x -= pushX
              posB.x += pushX
            } else {
              posA.x += pushX
              posB.x -= pushX
            }
          } else {
            // Push vertically
            if (posA.y < posB.y) {
              posA.y -= pushY
              posB.y += pushY
            } else {
              posA.y += pushY
              posB.y -= pushY
            }
          }
        }
      }
    }
  }
}

