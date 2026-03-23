import { memo } from 'react'
import {
  Database, FileCode, Layers, GitBranch, AlertTriangle, Code,
  BookOpen, Link2, ArrowRight,
} from 'lucide-react'
import type { BlockRenderProps } from '../../blocks/types'
import type { IndexBlockData } from './types'
import type { EntityEntry, ContextLinkEntry, PipelineEntry } from './types'

/** Color for each entity type */
const entityTypeColors: Record<string, string> = {
  file: '#60a5fa',
  system: '#a78bfa',
  interface: '#34d399',
  problem: '#f87171',
  pipeline: '#fbbf24',
  snippet: '#38bdf8',
  doc: '#818cf8',
  link: '#fb923c',
}

/** Icon for each entity type */
function EntityIcon({ type, size = 10 }: { type: string; size?: number }) {
  const color = entityTypeColors[type] || '#888'
  switch (type) {
    case 'file': return <FileCode size={size} color={color} />
    case 'system': return <Layers size={size} color={color} />
    case 'interface': return <GitBranch size={size} color={color} />
    case 'problem': return <AlertTriangle size={size} color={color} />
    case 'pipeline': return <ArrowRight size={size} color={color} />
    case 'snippet': return <Code size={size} color={color} />
    case 'doc': return <BookOpen size={size} color={color} />
    case 'link': return <Link2 size={size} color={color} />
    default: return <Database size={size} color={color} />
  }
}

/** Index card — renders an entity registry at different detail levels */
export const IndexCard = memo(function IndexCard({
  data,
  detail,
  theme,
}: BlockRenderProps<IndexBlockData>) {
  const { registry } = data
  const entities = Array.from(registry.entities.values())

  // Count by type
  const counts = new Map<string, number>()
  for (const e of entities) {
    counts.set(e.type, (counts.get(e.type) || 0) + 1)
  }

  if (detail === 'mini') {
    return (
      <div style={{
        borderLeft: `3px solid ${entityTypeColors.system}`,
        padding: '4px 8px',
        background: theme.bgSecondary,
        borderRadius: theme.radius,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: theme.fontSans,
      }}>
        <Database size={10} color={entityTypeColors.system} style={{ flexShrink: 0 }} />
        <span style={{
          fontSize: '0.95em',
          color: theme.textPrimary,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
        }}>
          Index ({entities.length} entities)
        </span>
        <div style={{ display: 'flex', gap: 3 }}>
          {Array.from(counts.entries()).map(([type, count]) => (
            <span key={type} style={{
              fontSize: '0.75em',
              padding: '1px 4px',
              borderRadius: 3,
              background: `${entityTypeColors[type] || '#888'}22`,
              color: entityTypeColors[type] || '#888',
            }}>
              {count}
            </span>
          ))}
        </div>
      </div>
    )
  }

  if (detail === 'summary') {
    return (
      <div style={{
        borderLeft: `3px solid ${entityTypeColors.system}`,
        padding: '6px 8px',
        background: theme.bgSecondary,
        borderRadius: theme.radius,
        fontFamily: theme.fontSans,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <Database size={10} color={entityTypeColors.system} style={{ flexShrink: 0 }} />
          <span style={{
            fontSize: '0.95em',
            color: theme.textPrimary,
            fontWeight: 600,
            flex: 1,
          }}>
            Codebase Index
          </span>
          <span style={{
            fontSize: '0.8em',
            color: theme.textMuted,
          }}>
            {entities.length} entities
          </span>
        </div>

        {/* Type summary badges */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {Array.from(counts.entries()).map(([type, count]) => (
            <span key={type} style={{
              fontSize: '0.8em',
              padding: '2px 6px',
              borderRadius: 3,
              background: `${entityTypeColors[type] || '#888'}22`,
              color: entityTypeColors[type] || '#888',
              display: 'flex',
              alignItems: 'center',
              gap: 3,
            }}>
              <EntityIcon type={type} size={9} />
              {count} {type}{count !== 1 ? 's' : ''}
            </span>
          ))}
        </div>
      </div>
    )
  }

  // detail === 'full'
  // Group entities by type, render sections
  const grouped = new Map<string, EntityEntry[]>()
  for (const e of entities) {
    const group = grouped.get(e.type) || []
    group.push(e)
    grouped.set(e.type, group)
  }

  return (
    <div style={{
      borderLeft: `3px solid ${entityTypeColors.system}`,
      padding: '8px 10px',
      background: theme.bgSecondary,
      borderRadius: theme.radius,
      fontFamily: theme.fontSans,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <Database size={12} color={entityTypeColors.system} style={{ flexShrink: 0 }} />
        <span style={{
          fontSize: '1em',
          color: theme.textPrimary,
          fontWeight: 600,
          flex: 1,
        }}>
          Codebase Index
        </span>
        <span style={{
          fontSize: '0.8em',
          color: theme.textMuted,
        }}>
          {entities.length} entities
        </span>
      </div>

      {/* Sections by type */}
      {Array.from(grouped.entries()).map(([type, entries]) => (
        <div key={type} style={{ marginBottom: 8 }}>
          {/* Section header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            marginBottom: 4,
            paddingBottom: 2,
            borderBottom: `1px solid ${theme.borderPrimary}`,
          }}>
            <EntityIcon type={type} size={10} />
            <span style={{
              fontSize: '0.85em',
              fontWeight: 600,
              color: entityTypeColors[type] || '#888',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              {type}s ({entries.length})
            </span>
          </div>

          {/* Entries */}
          {entries.map(entry => (
            <EntityRow key={entry.id} entry={entry} theme={theme} />
          ))}
        </div>
      ))}
    </div>
  )
})

/** Single entity row */
function EntityRow({ entry, theme }: { entry: EntityEntry; theme: BlockRenderProps['theme'] }) {
  const color = entityTypeColors[entry.type] || '#888'

  return (
    <div style={{
      padding: '2px 0 2px 8px',
      fontSize: '0.85em',
      display: 'flex',
      flexDirection: 'column',
      gap: 1,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {/* ID badge */}
        <span style={{
          fontFamily: theme.fontMono,
          fontSize: '0.85em',
          fontWeight: 700,
          color,
          minWidth: 32,
        }}>
          {entry.id}
        </span>
        <span style={{ color: theme.textPrimary, fontWeight: 500 }}>
          {entry.name}
        </span>
        {entry.description && (
          <span style={{ color: theme.textMuted, fontSize: '0.9em' }}>
            — {entry.description}
          </span>
        )}
      </div>

      {/* File refs */}
      {entry.refs.length > 0 && (
        <div style={{ paddingLeft: 36, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {entry.refs.map((ref, i) => (
            <span key={i} style={{
              fontFamily: theme.fontMono,
              fontSize: '0.8em',
              color: theme.textSecondary,
            }}>
              {ref.fileId}
              {ref.startLine !== undefined && `>${ref.startLine}`}
              {ref.endLine !== undefined && `-${ref.endLine}`}
              {ref.description && `:${ref.description}`}
              {ref.expandable && (
                <span style={{
                  marginLeft: 4,
                  padding: '0 3px',
                  borderRadius: 2,
                  background: `${theme.accent}22`,
                  color: theme.accent,
                  fontSize: '0.85em',
                }}>
                  {ref.expandable}
                </span>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Pipeline steps */}
      {entry.type === 'pipeline' && (
        <PipelineSteps entry={entry as PipelineEntry} theme={theme} />
      )}

      {/* Context link IDs */}
      {entry.type === 'link' && (
        <ContextLinkIds entry={entry as ContextLinkEntry} theme={theme} />
      )}
    </div>
  )
}

function PipelineSteps({ entry, theme }: { entry: PipelineEntry; theme: BlockRenderProps['theme'] }) {
  if (entry.steps.length === 0) return null
  return (
    <div style={{
      paddingLeft: 36,
      display: 'flex',
      alignItems: 'center',
      gap: 4,
      flexWrap: 'wrap',
      fontSize: '0.8em',
    }}>
      {entry.steps.map((step, i) => (
        <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {i > 0 && <ArrowRight size={8} color={theme.textMuted} />}
          <span style={{
            fontFamily: theme.fontMono,
            fontWeight: 600,
            color: entityTypeColors.file,
          }}>
            {step.fileId}
          </span>
          {step.description && (
            <span style={{ color: theme.textSecondary }}>
              {step.description}
            </span>
          )}
        </span>
      ))}
    </div>
  )
}

function ContextLinkIds({ entry, theme }: { entry: ContextLinkEntry; theme: BlockRenderProps['theme'] }) {
  if (entry.linkedIds.length === 0) return null
  return (
    <div style={{
      paddingLeft: 36,
      display: 'flex',
      gap: 3,
      flexWrap: 'wrap',
    }}>
      {entry.linkedIds.map(id => {
        const parsed = id.match(/^([A-Z]+)\d+$/)
        const prefix = parsed?.[1]?.toLowerCase() || ''
        const color = entityTypeColors[prefix] || entityTypeColors.link
        return (
          <span key={id} style={{
            fontFamily: theme.fontMono,
            fontSize: '0.8em',
            fontWeight: 600,
            padding: '1px 4px',
            borderRadius: 3,
            background: `${color}22`,
            color,
          }}>
            {id}
          </span>
        )
      })}
    </div>
  )
}
