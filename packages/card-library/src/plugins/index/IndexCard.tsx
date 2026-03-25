import { memo, useState, useCallback } from 'react'
import {
  Database, FileCode, Layers, GitBranch, AlertTriangle, Code,
  BookOpen, Link2, ArrowRight, ChevronRight,
} from 'lucide-react'
import type { BlockRenderProps } from '../../blocks/types'
import type { IndexBlockData, IndexLayer, FileRef } from './types'
import type { EntityEntry, ContextLinkEntry, PipelineEntry } from './types'
import { LAYER_TYPES } from './types'
import type { FileReader } from './resolver'
import { ExpandableFileContent, ExpandableRefChip } from './ExpandableContent'
import type { ReactNode } from 'react'

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

/** Layer labels for the layer picker */
const LAYER_LABELS: Record<IndexLayer, string> = {
  1: 'Core',
  2: 'Component',
  3: 'Detail',
  4: 'Expanded',
}

export interface IndexCardProps extends BlockRenderProps<IndexBlockData> {
  /** Optional file reader for expandable @CODE@/@MARKDOWN@ content */
  fileReader?: FileReader
  /** Optional syntax highlighter */
  highlighter?: (code: string, lang: string) => ReactNode
  /** Optional markdown renderer */
  markdownRenderer?: (content: string) => ReactNode
  /** Initial layer filter (default: show all) */
  initialLayer?: IndexLayer
}

/** Index card — renders an entity registry at different detail levels */
export const IndexCard = memo(function IndexCard({
  data,
  detail,
  theme,
  fileReader,
  highlighter,
  markdownRenderer,
  initialLayer,
}: IndexCardProps) {
  const { registry } = data
  const [layer, setLayer] = useState<IndexLayer | null>(initialLayer ?? null)
  const [expandedRefs, setExpandedRefs] = useState<Set<string>>(new Set())

  const toggleRef = useCallback((refKey: string) => {
    setExpandedRefs(prev => {
      const next = new Set(prev)
      if (next.has(refKey)) next.delete(refKey)
      else next.add(refKey)
      return next
    })
  }, [])

  // Apply layer filter if set
  const entities = layer !== null
    ? filterByLayer(Array.from(registry.entities.values()), layer)
    : Array.from(registry.entities.values())

  // Count by type
  const counts = new Map<string, number>()
  for (const e of entities) {
    counts.set(e.type, (counts.get(e.type) || 0) + 1)
  }

  const totalEntities = registry.entities.size

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
          Index ({totalEntities} entities)
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
            {totalEntities} entities
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
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
          {layer !== null ? `${entities.length}/${totalEntities}` : totalEntities} entities
        </span>
      </div>

      {/* Layer picker */}
      <div style={{
        display: 'flex',
        gap: 3,
        marginBottom: 8,
        flexWrap: 'wrap',
      }}>
        <LayerButton
          label="All"
          active={layer === null}
          onClick={() => setLayer(null)}
          theme={theme}
        />
        {([1, 2, 3, 4] as IndexLayer[]).map(l => (
          <LayerButton
            key={l}
            label={`L${l} ${LAYER_LABELS[l]}`}
            active={layer === l}
            onClick={() => setLayer(l)}
            theme={theme}
          />
        ))}
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
            <EntityRow
              key={entry.id}
              entry={entry}
              theme={theme}
              expandedRefs={expandedRefs}
              onToggleRef={toggleRef}
              registry={data.registry}
              fileReader={fileReader}
              highlighter={highlighter}
              markdownRenderer={markdownRenderer}
              stripRefs={layer === 1}
            />
          ))}
        </div>
      ))}
    </div>
  )
})

/** Layer filter button */
function LayerButton({ label, active, onClick, theme }: {
  label: string
  active: boolean
  onClick: () => void
  theme: BlockRenderProps['theme']
}) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '2px 8px',
        borderRadius: 3,
        border: `1px solid ${active ? theme.accent : theme.borderPrimary}`,
        background: active ? `${theme.accent}22` : 'transparent',
        color: active ? theme.accent : theme.textMuted,
        fontSize: '0.75em',
        fontFamily: theme.fontSans,
        cursor: 'pointer',
        fontWeight: active ? 600 : 400,
      }}
    >
      {label}
    </button>
  )
}

/** Filter entities by layer */
function filterByLayer(entities: EntityEntry[], layer: IndexLayer): EntityEntry[] {
  const allowedTypes = new Set(LAYER_TYPES[layer])
  return entities
    .filter(e => allowedTypes.has(e.type))
    .map(e => layer === 1 && e.refs.length > 0 ? { ...e, refs: [] } : e)
}

/** Format a ref as a unique key for expand tracking */
function refKey(entryId: string, ref: FileRef, index: number): string {
  return `${entryId}:${ref.fileId}>${ref.startLine ?? ''}${ref.endLine ? `-${ref.endLine}` : ''}:${index}`
}

/** Single entity row */
function EntityRow({ entry, theme, expandedRefs, onToggleRef, registry, fileReader, highlighter, markdownRenderer, stripRefs }: {
  entry: EntityEntry
  theme: BlockRenderProps['theme']
  expandedRefs: Set<string>
  onToggleRef: (key: string) => void
  registry: IndexBlockData['registry']
  fileReader?: FileReader
  highlighter?: (code: string, lang: string) => ReactNode
  markdownRenderer?: (content: string) => ReactNode
  stripRefs?: boolean
}) {
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
      {!stripRefs && entry.refs.length > 0 && (
        <div style={{ paddingLeft: 36, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {entry.refs.map((ref, i) => {
            const key = refKey(entry.id, ref, i)
            const isExpanded = expandedRefs.has(key)

            return (
              <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{
                  fontFamily: theme.fontMono,
                  fontSize: '0.8em',
                  color: theme.textSecondary,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}>
                  {ref.expandable && (
                    <ChevronRight
                      size={10}
                      color={theme.accent}
                      style={{
                        transform: isExpanded ? 'rotate(90deg)' : 'rotate(0)',
                        transition: 'transform 0.15s ease',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                      onClick={() => onToggleRef(key)}
                    />
                  )}
                  {ref.fileId}
                  {ref.startLine !== undefined && `>${ref.startLine}`}
                  {ref.endLine !== undefined && `-${ref.endLine}`}
                  {ref.description && `:${ref.description}`}
                  {ref.expandable && (
                    <ExpandableRefChip
                      fileRef={ref}
                      expanded={isExpanded}
                      onToggle={() => onToggleRef(key)}
                      theme={theme}
                    />
                  )}
                </span>

                {/* Expanded content */}
                {isExpanded && ref.expandable && fileReader && (
                  <div style={{ marginTop: 2, marginBottom: 4 }}>
                    <ExpandableFileContent
                      ref_={ref}
                      registry={registry}
                      fileReader={fileReader}
                      theme={theme}
                      highlighter={highlighter}
                      markdownRenderer={markdownRenderer}
                    />
                  </div>
                )}
              </div>
            )
          })}
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
