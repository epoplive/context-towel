import { memo, useState, useEffect } from 'react'
import type { ThemeTokens } from '../../blocks/types'
import type { ExpandableMarker, FileRef, EntityRegistryData } from './types'
import type { FileReader, ResolvedFileRef } from './resolver'
import { FileRefResolver } from './resolver'
import { CodeBlock } from '../../components/CodeBlock'
import type { ReactNode } from 'react'

// --- Expandable File Ref Context ---

export interface ExpandableFileRefProps {
  /** The file reference to expand */
  ref_: FileRef
  /** Entity registry for resolving F-IDs to paths */
  registry: EntityRegistryData
  /** File reader for loading content */
  fileReader: FileReader
  /** Theme tokens */
  theme: ThemeTokens
  /** Optional syntax highlighter for code blocks */
  highlighter?: (code: string, lang: string) => ReactNode
  /** Optional markdown renderer for @MARKDOWN@ blocks */
  markdownRenderer?: (content: string) => ReactNode
  /** Max height for the expanded content */
  maxHeight?: number
}

/**
 * Expandable content block for @CODE@ and @MARKDOWN@ file references.
 * Resolves the file reference, extracts the line range, and renders
 * with appropriate formatting (syntax-highlighted code or rendered markdown).
 */
export const ExpandableFileContent = memo(function ExpandableFileContent({
  ref_,
  registry,
  fileReader,
  theme,
  highlighter,
  markdownRenderer,
  maxHeight = 300,
}: ExpandableFileRefProps) {
  const [resolved, setResolved] = useState<ResolvedFileRef | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const resolver = new FileRefResolver(fileReader)
    resolver.resolve(ref_, registry).then(result => {
      if (cancelled) return
      if (result) {
        setResolved(result)
      } else {
        setError(`Could not resolve ${ref_.fileId}`)
      }
      setLoading(false)
    }).catch(err => {
      if (cancelled) return
      setError(err instanceof Error ? err.message : 'Failed to load')
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [ref_.fileId, ref_.startLine, ref_.endLine, registry, fileReader])

  if (loading) {
    return (
      <div style={{
        padding: '8px 10px',
        color: theme.textMuted,
        fontFamily: theme.fontMono,
        fontSize: '0.8em',
        fontStyle: 'italic',
      }}>
        Loading {ref_.fileId}
        {ref_.startLine !== undefined && `>${ref_.startLine}`}
        {ref_.endLine !== undefined && `-${ref_.endLine}`}...
      </div>
    )
  }

  if (error || !resolved) {
    return (
      <div style={{
        padding: '6px 10px',
        color: '#f87171',
        fontFamily: theme.fontMono,
        fontSize: '0.8em',
        background: '#f8717115',
        borderRadius: theme.radius,
        border: '1px solid #f8717130',
      }}>
        {error || 'File not found'}
      </div>
    )
  }

  // Header with file path and line range
  const header = (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '4px 10px',
      background: theme.bgTertiary,
      borderBottom: `1px solid ${theme.borderPrimary}`,
      fontFamily: theme.fontMono,
      fontSize: '0.75em',
      color: theme.textMuted,
    }}>
      <span>{resolved.path}:{resolved.startLine}-{resolved.endLine}</span>
      <span style={{
        padding: '1px 4px',
        borderRadius: 2,
        background: `${theme.accent}22`,
        color: theme.accent,
      }}>
        {resolved.language}
      </span>
    </div>
  )

  // @MARKDOWN@ renders as formatted markdown
  if (ref_.expandable === '@MARKDOWN@' && markdownRenderer) {
    return (
      <div style={{
        border: `1px solid ${theme.borderPrimary}`,
        borderRadius: theme.radius,
        overflow: 'hidden',
      }}>
        {header}
        <div style={{ maxHeight, overflow: 'auto', padding: '8px 10px' }}>
          {markdownRenderer(resolved.content)}
        </div>
      </div>
    )
  }

  // @CODE@ renders with syntax highlighting
  return (
    <div style={{
      border: `1px solid ${theme.borderPrimary}`,
      borderRadius: theme.radius,
      overflow: 'hidden',
    }}>
      {header}
      <CodeBlock
        code={resolved.content}
        language={resolved.language}
        theme={theme}
        maxHeight={maxHeight}
        highlighter={highlighter}
      />
    </div>
  )
})

// --- Expandable chip wrapper with toggle ---

export interface ExpandableRefChipProps {
  /** The file reference */
  fileRef: FileRef
  /** Whether currently expanded */
  expanded: boolean
  /** Toggle expand/collapse */
  onToggle: () => void
  /** Theme tokens */
  theme: ThemeTokens
}

/**
 * Small inline chip showing expandable marker with toggle.
 * Used inside entity rows to indicate expandable content.
 */
export const ExpandableRefChip = memo(function ExpandableRefChip({
  fileRef,
  expanded,
  onToggle,
  theme,
}: ExpandableRefChipProps) {
  const marker = fileRef.expandable as ExpandableMarker
  const isCode = marker === '@CODE@'

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        padding: '1px 5px',
        borderRadius: 3,
        background: expanded ? `${theme.accent}30` : `${theme.accent}15`,
        border: `1px solid ${expanded ? theme.accent : `${theme.accent}40`}`,
        color: theme.accent,
        fontSize: '0.8em',
        fontFamily: theme.fontMono,
        cursor: 'pointer',
        transition: 'all 0.15s ease',
      }}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      title={`${expanded ? 'Collapse' : 'Expand'} ${isCode ? 'code' : 'markdown'}`}
    >
      <span style={{
        transform: expanded ? 'rotate(90deg)' : 'rotate(0)',
        transition: 'transform 0.15s ease',
        display: 'inline-block',
        fontSize: '0.85em',
      }}>
        ▶
      </span>
      {isCode ? '{ }' : '{ md }'}
    </span>
  )
})
