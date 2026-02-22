/**
 * QuickTemplateSelector - dropdown for quickly selecting a prompt template.
 *
 * Displays available templates grouped by category with search/filter.
 */

import { useState, useEffect, useRef } from 'react'
import type { VersionedTemplate } from '../types'
import { getPresetTemplates } from '../services/template-registry'
import { usePromptBuilderStore } from '../context'

export interface QuickTemplateSelectorProps {
  onTemplateSelect: (template: VersionedTemplate) => void
  templates?: VersionedTemplate[]
  className?: string
}

export function QuickTemplateSelector({
  onTemplateSelect,
  templates: externalTemplates,
  className = '',
}: QuickTemplateSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Use external templates or fall back to store + presets
  let storeTemplates: VersionedTemplate[] = []
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    storeTemplates = usePromptBuilderStore((s) => s.templates)
  } catch {
    // Not inside a provider - use presets only
  }

  const templates = externalTemplates ?? (storeTemplates.length > 0 ? storeTemplates : getPresetTemplates())

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const categories = Array.from(new Set(templates.map((t) => t.category)))
  const filteredTemplates =
    selectedCategory === 'all'
      ? templates
      : templates.filter((t) => t.category === selectedCategory)

  const handleTemplateClick = (template: VersionedTemplate) => {
    onTemplateSelect(template)
    setIsOpen(false)
  }

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'coding':
        return 'Coding'
      case 'planning':
        return 'Planning'
      case 'general':
        return 'General'
      case 'custom':
        return 'Custom'
      default:
        return category
    }
  }

  return (
    <div className={className} ref={dropdownRef} data-testid="quick-template-selector">
      <button
        data-testid="template-selector-trigger"
        onClick={() => setIsOpen(!isOpen)}
        title="Select a prompt template"
      >
        Templates
      </button>

      {isOpen && (
        <div data-testid="template-selector-dropdown">
          <div data-testid="template-category-filters">
            <button
              data-testid="category-all"
              onClick={() => setSelectedCategory('all')}
              data-active={selectedCategory === 'all'}
            >
              All
            </button>
            {categories.map((category) => (
              <button
                key={category}
                data-testid={`category-${category}`}
                onClick={() => setSelectedCategory(category)}
                data-active={selectedCategory === category}
              >
                {getCategoryLabel(category)}
              </button>
            ))}
          </div>

          <div data-testid="template-list">
            {filteredTemplates.map((template) => (
              <div
                key={template.id}
                data-testid={`template-option-${template.id}`}
                onClick={() => handleTemplateClick(template)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') handleTemplateClick(template)
                }}
              >
                <div>{template.name}</div>
                {template.description && <div>{template.description}</div>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
