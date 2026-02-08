import { memo } from 'react'
import { Eye, Target } from 'lucide-react'

import { layoutPrimitives } from '../../compat/layoutPrimitives'
import { EdgeHandles } from './EdgeHandles'
import { getCardScale, useFlowColors } from './colors'

export interface WorkingDocNodeData {
  label: string
  path: string
  sections: { title: string; level: number }[]
  taskTitles: string[]
  checklistCount: number
  diagramCount: number
  loaded: boolean
  isFocused?: boolean
  cardScale?: number
  onPreview?: () => void
  onFocus?: () => void
}

interface WorkingDocNodeProps {
  data: WorkingDocNodeData
  selected?: boolean
}

export const WorkingDocNode = memo(({ data, selected }: WorkingDocNodeProps) => {
  const COLORS = useFlowColors()
  const scale = getCardScale(data)
  const scaleStyle = scale === 1
    ? {}
    : { transform: `scale(${scale})`, transformOrigin: 'top left' }
  const typeColor = COLORS.core

  const actionButtonStyle: React.CSSProperties = {
    border: 'none',
    background: `${typeColor}20`,
    color: typeColor,
    width: 18,
    height: 18,
    borderRadius: 4,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  }

  const actionGroupStyle: React.CSSProperties = {
    ...layoutPrimitives.row,
    alignItems: 'center',
    gap: '4px',
  }

  return (
    <div
      style={{
        background: COLORS.bg,
        border: `2px solid ${selected ? typeColor : COLORS.border}`,
        borderRadius: '8px',
        padding: '10px',
        minWidth: '200px',
        maxWidth: '280px',
        opacity: data.loaded ? 1 : 0.6,
        cursor: 'pointer',
        ...scaleStyle,
      }}
    >
      <EdgeHandles color={typeColor} />

      {/* Header */}
      <div style={{
        ...layoutPrimitives.row,
        alignItems: 'center',
        gap: '6px',
        marginBottom: '8px',
        borderBottom: `1px solid ${COLORS.border}`,
        paddingBottom: '6px',
      }}>
        <span style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: typeColor,
        }} />
        <span style={{
          color: COLORS.text,
          fontWeight: 600,
          fontSize: '12px',
          flex: 1,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {data.label}
        </span>
        <div style={actionGroupStyle}>
          <button
            type="button"
            title="Preview"
            style={actionButtonStyle}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation()
              data.onPreview?.()
            }}
          >
            <Eye size={10} />
          </button>
          <button
            type="button"
            title="Focus"
            style={actionButtonStyle}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation()
              data.onFocus?.()
            }}
          >
            <Target size={10} />
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div style={{
        ...layoutPrimitives.row,
        gap: '8px',
        marginBottom: data.sections.length > 0 || data.taskTitles.length > 0 ? '8px' : 0,
        fontSize: '9px',
        color: COLORS.textMuted,
      }}>
        {data.taskTitles.length > 0 && (
          <span>📋 {data.taskTitles.length} tasks</span>
        )}
        {data.checklistCount > 0 && (
          <span>☑️ {data.checklistCount}</span>
        )}
        {data.diagramCount > 0 && (
          <span>📊 {data.diagramCount}</span>
        )}
      </div>

      {/* Outline - section titles */}
      {data.sections.length > 0 && (
        <div style={{ marginBottom: data.taskTitles.length > 0 ? '8px' : 0 }}>
          <div style={{
            fontSize: '8px',
            color: COLORS.textMuted,
            textTransform: 'uppercase',
            marginBottom: '4px',
          }}>
            Outline
          </div>
          {data.sections.map((section, i) => (
            <div
              key={i}
              style={{
                fontSize: '10px',
                color: section.level === 1 ? COLORS.text : COLORS.textSecondary,
                paddingLeft: section.level > 1 ? '8px' : 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                lineHeight: 1.4,
              }}
            >
              {section.title}
            </div>
          ))}
        </div>
      )}

      {/* Task titles */}
      {data.taskTitles.length > 0 && (
        <div>
          <div style={{
            fontSize: '8px',
            color: COLORS.textMuted,
            textTransform: 'uppercase',
            marginBottom: '4px',
          }}>
            Tasks
          </div>
          {data.taskTitles.map((title, i) => (
            <div
              key={i}
              style={{
                fontSize: '10px',
                color: COLORS.text,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                lineHeight: 1.4,
              }}
            >
              • {title}
            </div>
          ))}
        </div>
      )}
    </div>
  )
})

