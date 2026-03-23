import { memo, useContext, createContext } from 'react'
import {
  FileCode, Layers, GitBranch, AlertTriangle,
  ArrowRight, Code, BookOpen, Link2, Database,
} from 'lucide-react'
import type { EntityEntry, EntityRegistryData } from './types'
import type { ThemeTokens } from '../../blocks/types'

// --- Context for entity registry ---

export const EntityRegistryContext = createContext<EntityRegistryData | null>(null)

/** Hook to access the nearest EntityRegistry from context */
export function useEntityRegistry(): EntityRegistryData | null {
  return useContext(EntityRegistryContext)
}

// --- Entity type colors and icons ---

export const entityTypeColors: Record<string, string> = {
  file: '#60a5fa',
  system: '#a78bfa',
  interface: '#34d399',
  problem: '#f87171',
  pipeline: '#fbbf24',
  snippet: '#38bdf8',
  doc: '#818cf8',
  link: '#fb923c',
}

function getEntityIcon(type: string, size: number) {
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

// --- Entity Ref Chip component ---

export interface EntityRefChipProps {
  /** The entity ID (e.g. "F1", "S1", "CL1") */
  entityId: string
  /** Optional resolved entity (avoids context lookup) */
  entity?: EntityEntry
  /** Theme tokens for styling */
  theme: ThemeTokens
  /** Click handler */
  onClick?: (entityId: string, entity?: EntityEntry) => void
  /** Size variant */
  size?: 'small' | 'medium'
}

/**
 * Interactive chip that renders an entity ID reference.
 * Resolves the entity from EntityRegistryContext if not provided directly.
 * Shows icon + ID + name on hover.
 */
export const EntityRefChip = memo(function EntityRefChip({
  entityId,
  entity: propEntity,
  theme,
  onClick,
  size = 'small',
}: EntityRefChipProps) {
  const registry = useEntityRegistry()

  // Resolve entity from context if not provided
  const entity = propEntity ?? registry?.entities.get(entityId)
  const type = entity?.type || guessTypeFromId(entityId)
  const color = entityTypeColors[type] || '#888'
  const iconSize = size === 'small' ? 9 : 11

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: size === 'small' ? 2 : 3,
        padding: size === 'small' ? '0px 4px' : '1px 6px',
        borderRadius: 3,
        background: `${color}18`,
        border: `1px solid ${color}33`,
        fontFamily: theme.fontMono,
        fontSize: size === 'small' ? '0.8em' : '0.85em',
        fontWeight: 600,
        color,
        cursor: onClick ? 'pointer' : 'default',
        whiteSpace: 'nowrap',
        lineHeight: 1.4,
      }}
      title={entity ? `${entity.name}${entity.description ? ` — ${entity.description}` : ''}` : entityId}
      onClick={onClick ? () => onClick(entityId, entity) : undefined}
    >
      {getEntityIcon(type, iconSize)}
      <span>{entityId}</span>
      {entity && size === 'medium' && (
        <span style={{ color: theme.textSecondary, fontWeight: 400, fontFamily: theme.fontSans }}>
          {entity.name}
        </span>
      )}
    </span>
  )
})

// --- File Ref Chip (with line range) ---

export interface FileRefChipProps {
  /** File entity ID */
  fileId: string
  /** Start line */
  startLine?: number
  /** End line */
  endLine?: number
  /** Description */
  description?: string
  /** Whether this ref is expandable */
  expandable?: '@CODE@' | '@MARKDOWN@'
  /** Theme tokens */
  theme: ThemeTokens
  /** Click handler */
  onClick?: (fileId: string, startLine?: number, endLine?: number) => void
  /** Expand handler (for @CODE@/@MARKDOWN@) */
  onExpand?: (fileId: string, startLine?: number, endLine?: number) => void
}

export const FileRefChip = memo(function FileRefChip({
  fileId,
  startLine,
  endLine,
  description,
  expandable,
  theme,
  onClick,
  onExpand,
}: FileRefChipProps) {
  const registry = useEntityRegistry()
  const filePath = registry?.files.get(fileId)
  const color = entityTypeColors.file

  const lineRange = startLine !== undefined
    ? endLine !== undefined ? `${startLine}-${endLine}` : `${startLine}`
    : ''

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        padding: '1px 5px',
        borderRadius: 3,
        background: `${color}15`,
        border: `1px solid ${color}30`,
        fontFamily: theme.fontMono,
        fontSize: '0.8em',
        color: theme.textSecondary,
        cursor: onClick ? 'pointer' : 'default',
        whiteSpace: 'nowrap',
      }}
      title={filePath ? `${filePath}${lineRange ? `:${lineRange}` : ''}` : fileId}
      onClick={onClick ? () => onClick(fileId, startLine, endLine) : undefined}
    >
      <FileCode size={9} color={color} />
      <span style={{ color, fontWeight: 600 }}>{fileId}</span>
      {lineRange && (
        <span style={{ color: theme.textMuted }}>:{lineRange}</span>
      )}
      {description && (
        <span style={{ color: theme.textSecondary, fontFamily: theme.fontSans, fontWeight: 400 }}>
          {description}
        </span>
      )}
      {expandable && onExpand && (
        <span
          style={{
            padding: '0 3px',
            borderRadius: 2,
            background: `${theme.accent}22`,
            color: theme.accent,
            fontSize: '0.85em',
            cursor: 'pointer',
          }}
          onClick={(e) => {
            e.stopPropagation()
            onExpand(fileId, startLine, endLine)
          }}
        >
          {expandable === '@CODE@' ? '{ }' : '{ md }'}
        </span>
      )}
    </span>
  )
})

// --- Helpers ---

/** Guess entity type from ID prefix when no registry is available */
function guessTypeFromId(id: string): string {
  if (id.startsWith('PF')) return 'pipeline'
  if (id.startsWith('CS')) return 'snippet'
  if (id.startsWith('DS')) return 'doc'
  if (id.startsWith('CL')) return 'link'
  if (id.startsWith('F')) return 'file'
  if (id.startsWith('S')) return 'system'
  if (id.startsWith('I')) return 'interface'
  if (id.startsWith('P')) return 'problem'
  return 'file'
}

/**
 * Regex pattern that matches entity ID references in text.
 * Matches: F1, S1, I1, PF1, CS1, DS1, CL1 (with numbers)
 * Anchored by word boundaries to avoid false positives.
 */
export const ENTITY_ID_PATTERN = /\b((?:PF|CS|DS|CL|F|S|I|P)\d+)\b/g
