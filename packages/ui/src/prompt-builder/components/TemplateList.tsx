/**
 * TemplateList - displays a list of available prompt templates.
 *
 * Shows templates with category filters, search, and actions
 * (apply, edit, delete, duplicate).
 */

import { useState, useMemo } from 'react'
import type { VersionedTemplate } from '../types'

export interface TemplateListProps {
  templates: VersionedTemplate[]
  onSelect: (template: VersionedTemplate) => void
  onEdit?: (template: VersionedTemplate) => void
  onDelete?: (templateId: string) => void
  onDuplicate?: (template: VersionedTemplate) => void
  selectedId?: string
}

export function TemplateList({
  templates,
  onSelect,
  onEdit,
  onDelete,
  onDuplicate,
  selectedId,
}: TemplateListProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCategory, setFilterCategory] = useState<string>('all')

  const categories = useMemo(() => {
    const cats = new Set(templates.map((t) => t.category))
    return Array.from(cats).sort()
  }, [templates])

  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      if (filterCategory !== 'all' && t.category !== filterCategory) return false
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        return (
          t.name.toLowerCase().includes(query) ||
          t.description.toLowerCase().includes(query) ||
          t.prompt.toLowerCase().includes(query)
        )
      }
      return true
    })
  }, [templates, filterCategory, searchQuery])

  return (
    <div data-testid="template-list-panel">
      <div data-testid="template-search">
        <input
          type="text"
          data-testid="template-search-input"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search templates..."
        />
      </div>

      <div data-testid="template-category-filter">
        <button
          data-testid="filter-all"
          onClick={() => setFilterCategory('all')}
          data-active={filterCategory === 'all'}
        >
          All ({templates.length})
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            data-testid={`filter-${cat}`}
            onClick={() => setFilterCategory(cat)}
            data-active={filterCategory === cat}
          >
            {cat} ({templates.filter((t) => t.category === cat).length})
          </button>
        ))}
      </div>

      <div data-testid="template-items">
        {filteredTemplates.length === 0 && (
          <div data-testid="no-templates">No templates found.</div>
        )}
        {filteredTemplates.map((template) => (
          <div
            key={template.id}
            data-testid={`template-item-${template.id}`}
            data-selected={template.id === selectedId}
            onClick={() => onSelect(template)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') onSelect(template)
            }}
          >
            <div data-testid={`template-name-${template.id}`}>{template.name}</div>
            <div data-testid={`template-desc-${template.id}`}>{template.description}</div>
            <div data-testid={`template-category-${template.id}`}>{template.category}</div>

            <div data-testid={`template-actions-${template.id}`}>
              {onEdit && (
                <button
                  data-testid={`edit-btn-${template.id}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onEdit(template)
                  }}
                >
                  Edit
                </button>
              )}
              {onDuplicate && (
                <button
                  data-testid={`duplicate-btn-${template.id}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onDuplicate(template)
                  }}
                >
                  Duplicate
                </button>
              )}
              {onDelete && template.author === 'user' && (
                <button
                  data-testid={`delete-btn-${template.id}`}
                  onClick={(e) => {
                    e.stopPropagation()
                    onDelete(template.id)
                  }}
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
