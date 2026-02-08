import { memo } from 'react'
import { Eye, FileCode, LayoutGrid, Link } from 'lucide-react'

import { layoutPrimitives } from '../../compat/layoutPrimitives'
import { EdgeHandles } from './EdgeHandles'
import { getCardScale, useFlowColors } from './colors'

export type LinkCardStatus = 'internal' | 'external' | 'missing' | 'unresolved'

export interface LinkCardItem {
  id: string
  label: string
  target: string
  status: LinkCardStatus
  targetPath?: string
  targetId?: string
  sourceLine?: number
}

export type LinkCardAction = 'preview' | 'panel' | 'editor' | 'follow'

export interface LinkCardNodeData {
  parentDocId: string
  docName: string
  links: LinkCardItem[]
  cardScale?: number
  onLinkAction?: (link: LinkCardItem, action: LinkCardAction) => void
}

interface LinkCardNodeProps {
  data: LinkCardNodeData
  selected?: boolean
}

export const LinkCardNode = memo(({ data, selected }: LinkCardNodeProps) => {
  const COLORS = useFlowColors()
  const scale = getCardScale(data)
  const scaleStyle = scale === 1 ? {} : { transform: `scale(${scale})`, transformOrigin: 'top left' }

  const links = data.links || []
  const internalLinks = links.filter(link => link.status === 'internal')
  const externalLinks = links.filter(link => link.status === 'external')
  const brokenLinks = links.filter(link => link.status === 'missing' || link.status === 'unresolved')

  const actionButtonStyle: React.CSSProperties = {
    border: 'none',
    background: `${COLORS.warning}20`,
    color: COLORS.warning,
    width: 18,
    height: 18,
    borderRadius: 4,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  }

  const renderLinkRow = (link: LinkCardItem, actions: LinkCardAction[]) => (
    <div key={link.id} style={{ ...layoutPrimitives.row, alignItems: 'center', gap: '6px' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '10px',
          fontWeight: 600,
          color: COLORS.text,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {link.label || link.target}
        </div>
        <div style={{
          fontSize: '9px',
          color: COLORS.textMuted,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}>
          {link.targetPath || link.target}
        </div>
      </div>
      {data.onLinkAction && actions.length > 0 && (
        <div style={{ ...layoutPrimitives.row, gap: '4px' }}>
          {actions.includes('preview') && (
            <button
              type="button"
              title="Preview"
              style={actionButtonStyle}
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation()
                data.onLinkAction?.(link, 'preview')
              }}
            >
              <Eye size={10} />
            </button>
          )}
          {actions.includes('panel') && (
            <button
              type="button"
              title="Open Panel"
              style={actionButtonStyle}
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation()
                data.onLinkAction?.(link, 'panel')
              }}
            >
              <LayoutGrid size={10} />
            </button>
          )}
          {actions.includes('editor') && (
            <button
              type="button"
              title="Open Editor"
              style={actionButtonStyle}
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation()
                data.onLinkAction?.(link, 'editor')
              }}
            >
              <FileCode size={10} />
            </button>
          )}
          {actions.includes('follow') && (
            <button
              type="button"
              title="Add Root"
              style={actionButtonStyle}
              onMouseDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation()
                data.onLinkAction?.(link, 'follow')
              }}
            >
              <Link size={10} />
            </button>
          )}
        </div>
      )}
    </div>
  )

  const renderSection = (title: string, items: LinkCardItem[], actions: LinkCardAction[]) => {
    if (items.length === 0) return null
    return (
      <div style={{ marginBottom: '8px' }}>
        <div style={{
          fontSize: '9px',
          fontWeight: 600,
          textTransform: 'uppercase',
          color: COLORS.textMuted,
          marginBottom: '4px',
        }}>
          {title}
        </div>
        <div style={{ ...layoutPrimitives.column, gap: '6px' }}>
          {items.map(item => renderLinkRow(item, actions))}
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        background: COLORS.bg,
        border: `2px solid ${selected ? COLORS.warning : COLORS.border}`,
        borderLeft: `4px solid ${COLORS.warning}`,
        borderRadius: '8px',
        padding: '8px',
        minWidth: '220px',
        maxWidth: '320px',
        cursor: 'pointer',
        ...scaleStyle,
      }}
    >
      <EdgeHandles color={COLORS.warning} />
      <div style={{
        ...layoutPrimitives.row,
        alignItems: 'center',
        gap: '6px',
        marginBottom: '8px',
      }}>
        <Link size={12} color={COLORS.warning} />
        <span style={{ fontSize: '11px', fontWeight: 600, color: COLORS.text, flex: 1 }}>
          Links
        </span>
        <span style={{
          background: `${COLORS.warning}20`,
          color: COLORS.warning,
          padding: '1px 6px',
          borderRadius: '10px',
          fontSize: '9px',
          fontWeight: 600,
        }}>
          {links.length}
        </span>
      </div>
      {renderSection('In Project', internalLinks, ['preview', 'panel', 'editor'])}
      {renderSection('External', externalLinks, ['preview', 'panel', 'follow'])}
      {renderSection('Broken', brokenLinks, [])}
    </div>
  )
})

