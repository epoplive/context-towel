import { memo } from 'react'
import type { BlockRenderProps } from '../../blocks/types'
import type { TocData, TocSectionData } from './types'

export const TocCard = memo(function TocCard({
  data,
  detail,
  theme,
}: BlockRenderProps<TocData>) {
  if (detail === 'mini') {
    return (
      <div style={{
        padding: '4px 8px',
        background: theme.bgSecondary,
        borderRadius: theme.radius,
        borderLeft: `3px solid ${theme.accent}`,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: theme.fontSans,
      }}>
        <span style={{ fontSize: '0.95em', color: theme.textPrimary }}>{data.docName}</span>
        <span style={{ fontSize: '0.85em', color: theme.textMuted }}>
          {data.sections.length} sections
        </span>
      </div>
    )
  }

  const maxDepth = detail === 'summary' ? 2 : 4

  return (
    <div style={{
      padding: '8px 10px',
      background: theme.bgSecondary,
      borderRadius: theme.radius,
      borderLeft: `3px solid ${theme.accent}`,
      fontFamily: theme.fontSans,
    }}>
      <div style={{ fontSize: '0.95em', color: theme.textPrimary, fontWeight: 600, marginBottom: 6 }}>
        {data.docName}
      </div>
      <div>
        {data.sections.map((section, i) => (
          <SectionRow key={i} section={section} depth={0} maxDepth={maxDepth} theme={theme} />
        ))}
      </div>
    </div>
  )
})

function SectionRow({
  section,
  depth,
  maxDepth,
  theme,
}: {
  section: TocSectionData
  depth: number
  maxDepth: number
  theme: { textPrimary: string; textSecondary: string; textMuted: string; accent: string; success: string }
}) {
  if (depth >= maxDepth) return null

  const indent = depth * 12
  const counts = section.counts

  return (
    <>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        paddingLeft: indent,
        padding: '1px 0',
        paddingInlineStart: indent,
      }}>
        <span style={{
          fontSize: depth === 0 ? '0.9em' : '0.85em',
          color: depth === 0 ? theme.accent : theme.textSecondary,
          fontWeight: depth === 0 ? 600 : 400,
          flex: 1,
        }}>
          {section.title}
        </span>
        {counts && counts.tasks > 0 && (
          <span style={{
            fontSize: '0.8em',
            color: counts.tasksCompleted === counts.tasks ? theme.success : theme.textMuted,
          }}>
            {counts.tasksCompleted}/{counts.tasks}
          </span>
        )}
      </div>
      {section.children.map((child, i) => (
        <SectionRow key={i} section={child} depth={depth + 1} maxDepth={maxDepth} theme={theme} />
      ))}
    </>
  )
}
