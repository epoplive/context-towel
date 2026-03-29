/**
 * SitePageGraphNode — React Flow node wrapper for SitePageCard.
 * Used in GraphCanvas to render sitepage blocks as interactive graph nodes.
 */
import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import { SitePageCard } from './SitePageCard'
import type { SitePageBlockData } from './types'
import { defaultTheme } from '../../blocks/types'

interface SitePageGraphNodeProps {
  data: SitePageBlockData & {
    onClick?: () => void
    screenshotUrl?: string
  }
}

export const SitePageGraphNode = memo(function SitePageGraphNode({ data }: SitePageGraphNodeProps) {
  return (
    <div onClick={data.onClick} style={{ cursor: data.onClick ? 'pointer' : 'default', position: 'relative' }}>
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />

      {/* Screenshot thumbnail if available */}
      {data.screenshotUrl && (
        <div style={{
          width: 200, height: 120, borderRadius: '8px 8px 0 0', overflow: 'hidden',
          border: `1px solid ${defaultTheme.borderSecondary}`, borderBottom: 'none',
        }}>
          <img
            src={data.screenshotUrl}
            alt={data.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'top' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        </div>
      )}

      {/* Card content */}
      <div style={{ width: 200 }}>
        <SitePageCard
          data={data}
          detail="summary"
          theme={defaultTheme}
          source={{ filePath: '', range: { startOffset: null, endOffset: null, startLine: null, endLine: null }, raw: '' }}
        />
      </div>

      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  )
})
