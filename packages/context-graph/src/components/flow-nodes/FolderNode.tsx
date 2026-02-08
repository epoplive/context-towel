import { memo } from 'react'
import { ChevronDown, ChevronRight, Folder } from 'lucide-react'

import { layoutPrimitives } from '../../compat/layoutPrimitives'
import { EdgeHandles } from './EdgeHandles'
import { getCardScale, useFlowColors } from './colors'

export interface FolderNodeData {
  label: string
  childCount: number
  type: 'core' | 'research' | 'skill' | 'spike' | 'other'
  isExpanded: boolean
  cardScale?: number
}

interface FolderNodeProps {
  data: FolderNodeData
  selected?: boolean
}

export const FolderNode = memo(({ data, selected }: FolderNodeProps) => {
  const COLORS = useFlowColors()
  const scale = getCardScale(data)
  const scaleStyle = scale === 1
    ? {}
    : { transform: `scale(${scale})`, transformOrigin: 'top left' }
  const typeColors: Record<string, string> = {
    core: COLORS.core,
    research: COLORS.research,
    skill: COLORS.skill,
    spike: COLORS.spike,
    other: COLORS.folder,
  }
  const typeColor = typeColors[data.type] || COLORS.folder

  return (
    <div
      style={{
        background: COLORS.bg,
        border: `2px solid ${selected ? typeColor : COLORS.border}`,
        borderLeft: `4px solid ${typeColor}`,
        borderRadius: '8px',
        padding: '8px 12px 8px 10px',
        minWidth: '120px',
        cursor: 'pointer',
        ...scaleStyle,
        boxShadow: selected ? `0 0 0 1px ${typeColor}40` : 'none',
      }}
    >
      <EdgeHandles color={typeColor} />

      <div style={{ ...layoutPrimitives.row, alignItems: 'center', gap: '8px' }}>
        <span style={{ ...layoutPrimitives.row, alignItems: 'center', color: typeColor }}>
          {data.isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
        <Folder size={14} color={typeColor} style={{ flexShrink: 0 }} />
        <span style={{ color: COLORS.text, fontWeight: 600, fontSize: '12px' }}>
          {data.label}
        </span>
        <span style={{
          background: `${typeColor}20`,
          color: typeColor,
          padding: '2px 8px',
          borderRadius: '10px',
          fontSize: '10px',
          fontWeight: 600,
        }}>
          {data.childCount}
        </span>
      </div>
    </div>
  )
})

