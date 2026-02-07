import { memo } from 'react'
import {
  FileText, BookOpen, GitCommit, Eye, Lightbulb, Users, ScrollText, Hash, Link2,
} from 'lucide-react'
import type { BlockRenderProps } from '../../blocks/types'
import type { NoteData } from './types'
import { noteTypeColors } from './types'

/** Note card — renders a note block at different detail levels */
export const NoteCard = memo(function NoteCard({
  data,
  detail,
  theme,
}: BlockRenderProps<NoteData>) {
  const noteType = data.noteType || 'reference'
  const noteColor = noteTypeColors[noteType] || noteTypeColors.reference
  const NoteIcon = getNoteIcon(noteType)

  if (detail === 'mini') {
    return (
      <div style={{
        borderLeft: `3px solid ${noteColor}`,
        padding: '4px 8px',
        background: theme.bgSecondary,
        borderRadius: theme.radius,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: theme.fontSans,
      }}>
        <NoteIcon size={10} color={noteColor} style={{ flexShrink: 0 }} />
        <span style={{
          fontSize: 11,
          color: theme.textPrimary,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
        }}>
          {data.title}
        </span>
        <TypeBadge type={noteType} color={noteColor} />
      </div>
    )
  }

  if (detail === 'summary') {
    const contentPreview = data.content.slice(0, 100)
    const truncated = data.content.length > 100

    return (
      <div style={{
        borderLeft: `3px solid ${noteColor}`,
        padding: '6px 8px',
        background: theme.bgSecondary,
        borderRadius: theme.radius,
        fontFamily: theme.fontSans,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <NoteIcon size={10} color={noteColor} style={{ flexShrink: 0 }} />
          <span style={{
            fontSize: 11,
            color: theme.textPrimary,
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}>
            {data.title}
          </span>
          <TypeBadge type={noteType} color={noteColor} />
        </div>

        {/* Content preview */}
        <div style={{
          fontSize: 9,
          color: theme.textSecondary,
          marginBottom: 4,
          lineHeight: 1.4,
        }}>
          {contentPreview}{truncated && '...'}
        </div>

        {/* Tags */}
        {data.tags && data.tags.length > 0 && (
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            {data.tags.slice(0, 3).map((tag) => (
              <span key={tag} style={{
                fontSize: 8,
                padding: '1px 5px',
                borderRadius: 3,
                background: `${theme.accent}22`,
                color: theme.accent,
              }}>
                {tag}
              </span>
            ))}
            {data.tags.length > 3 && (
              <span style={{ fontSize: 8, color: theme.textMuted }}>
                +{data.tags.length - 3}
              </span>
            )}
          </div>
        )}
      </div>
    )
  }

  // detail === 'full'
  return (
    <div style={{
      borderLeft: `3px solid ${noteColor}`,
      padding: '8px 10px',
      background: theme.bgSecondary,
      borderRadius: theme.radius,
      fontFamily: theme.fontSans,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <NoteIcon size={12} color={noteColor} style={{ flexShrink: 0 }} />
        <span style={{
          fontSize: 12,
          color: theme.textPrimary,
          fontWeight: 600,
          flex: 1,
        }}>
          {data.title}
        </span>
        <TypeBadge type={noteType} color={noteColor} />
        {data.active !== undefined && (
          <span style={{
            fontSize: 7,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            padding: '1px 5px',
            borderRadius: 3,
            background: data.active ? `${theme.success}22` : `${theme.textMuted}22`,
            color: data.active ? theme.success : theme.textMuted,
          }}>
            {data.active ? 'ACTIVE' : 'INACTIVE'}
          </span>
        )}
      </div>

      {/* Content */}
      <div style={{
        fontSize: 10,
        color: theme.textSecondary,
        marginBottom: 6,
        lineHeight: 1.5,
        whiteSpace: 'pre-wrap',
      }}>
        {data.content}
      </div>

      {/* Tags */}
      {data.tags && data.tags.length > 0 && (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6, alignItems: 'center' }}>
          <Hash size={8} color={theme.textMuted} style={{ flexShrink: 0 }} />
          {data.tags.map((tag) => (
            <span key={tag} style={{
              fontSize: 8,
              padding: '1px 5px',
              borderRadius: 3,
              background: `${theme.accent}22`,
              color: theme.accent,
            }}>
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Entity Links */}
      {data.entityLinks && data.entityLinks.length > 0 && (
        <div style={{ marginBottom: 6 }}>
          <div style={{
            fontSize: 8,
            color: theme.textMuted,
            textTransform: 'uppercase',
            marginBottom: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}>
            <Link2 size={8} />
            Entity Links
          </div>
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap' }}>
            {data.entityLinks.map((link, i) => (
              <span key={i} style={{
                fontSize: 8,
                padding: '1px 5px',
                borderRadius: 3,
                background: `${theme.accent}22`,
                color: theme.accent,
              }}>
                {link.entityType}{link.entityName ? `: ${link.entityName}` : ''}
                {link.strength !== undefined && ` (${link.strength})`}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Timestamps */}
      {(data.createdAt || data.updatedAt) && (
        <div style={{ fontSize: 8, color: theme.textMuted, display: 'flex', gap: 8 }}>
          {data.createdAt && <span>Created: {data.createdAt}</span>}
          {data.updatedAt && <span>Updated: {data.updatedAt}</span>}
        </div>
      )}
    </div>
  )
})

// --- Subcomponents ---

function TypeBadge({ type, color }: { type: string; color: string }) {
  return (
    <span style={{
      fontSize: 7,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
      padding: '1px 5px',
      borderRadius: 3,
      background: `${color}22`,
      color,
      whiteSpace: 'nowrap',
    }}>
      {type}
    </span>
  )
}

function getNoteIcon(noteType: string) {
  switch (noteType) {
    case 'reference': return BookOpen
    case 'decision': return GitCommit
    case 'observation': return Eye
    case 'idea': return Lightbulb
    case 'meeting': return Users
    case 'log': return ScrollText
    default: return FileText
  }
}
