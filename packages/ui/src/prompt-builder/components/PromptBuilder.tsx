/**
 * PromptBuilder - main prompt builder UI component.
 *
 * Provides a full-featured interface for building and managing prompts
 * with template selection, variable customization, and chain management.
 *
 * Must be used within a PromptBuilderProvider.
 */

import { useState, useMemo } from 'react'
import type { SystemPrompt, VersionedTemplate, TemplateVariable } from '../types'
import { usePromptBuilderStore } from '../context'
import { getPresetTemplates, mergeTemplates, fillVersionedTemplate, createTemplate } from '../services/template-registry'
import { TemplateList } from './TemplateList'
import { VariableEditor } from './VariableEditor'
import { VariableInput } from './VariableInput'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TabMode = 'chains' | 'templates' | 'variables'

export interface PromptBuilderProps {
  /** Current prompts in the chain. */
  currentPrompts?: SystemPrompt[]
  /** Called when the user applies the prompt chain. */
  onUpdate: (prompts: SystemPrompt[]) => void
  /** Called when the user closes the builder. */
  onClose: () => void
  /** Optional conversation ID for scoped variables. */
  conversationId?: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PromptBuilder({
  currentPrompts = [],
  onUpdate,
  onClose,
  conversationId: _conversationId,
}: PromptBuilderProps) {
  const storePrompts = usePromptBuilderStore((s) => s.prompts)
  const storeTemplates = usePromptBuilderStore((s) => s.templates)
  const userTemplates = usePromptBuilderStore((s) => s.userTemplates)
  const setPrompts = usePromptBuilderStore((s) => s.setPrompts)
  const setStoreTemplates = usePromptBuilderStore((s) => s.setTemplates)
  const addUserTemplate = usePromptBuilderStore((s) => s.addUserTemplate)

  const [activeTab, setActiveTab] = useState<TabMode>('templates')
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [templateValues, setTemplateValues] = useState<Record<string, unknown>>({})
  const [editingNewTemplate, setEditingNewTemplate] = useState(false)
  const [newTemplateName, setNewTemplateName] = useState('')
  const [newTemplateDescription, setNewTemplateDescription] = useState('')
  const [newTemplateCategory, setNewTemplateCategory] = useState('custom')
  const [newTemplateContent, setNewTemplateContent] = useState('')
  const [newTemplateVariables, setNewTemplateVariables] = useState<Record<string, TemplateVariable>>({})

  // Initialize prompts from props if store is empty
  const prompts = storePrompts.length > 0 ? storePrompts : currentPrompts

  // Merge preset + user templates
  const allTemplates = useMemo(() => {
    const presets = getPresetTemplates()
    const fromStore = storeTemplates.length > 0 ? storeTemplates : presets
    return mergeTemplates(fromStore, userTemplates)
  }, [storeTemplates, userTemplates])

  const selectedTemplate = useMemo(
    () => (selectedTemplateId ? allTemplates.find((t) => t.id === selectedTemplateId) : null),
    [selectedTemplateId, allTemplates],
  )

  // ------ Actions ------

  const handleSelectTemplate = (template: VersionedTemplate) => {
    setSelectedTemplateId(template.id)
    setTemplateValues({})
  }

  const handleApplyTemplate = () => {
    if (!selectedTemplate) return

    let content: string
    if (
      selectedTemplate.variables &&
      Object.keys(selectedTemplate.variables).length > 0 &&
      Object.keys(templateValues).length > 0
    ) {
      content = fillVersionedTemplate(selectedTemplate, templateValues)
    } else {
      content = selectedTemplate.prompt
    }

    const newPrompt: SystemPrompt = {
      id: `prompt-${Date.now()}`,
      type: 'main',
      source: 'template',
      content,
      templateId: selectedTemplate.id,
      templateName: selectedTemplate.name,
      originalTemplate: selectedTemplate,
      templateValues,
    }

    const updated = [...prompts, newPrompt]
    setPrompts(updated)
  }

  const handleRemovePrompt = (promptId: string) => {
    const updated = prompts.filter((p) => p.id !== promptId)
    setPrompts(updated)
  }

  const handleAddCustomPrompt = () => {
    const newPrompt: SystemPrompt = {
      id: `custom-${Date.now()}`,
      type: 'custom',
      source: 'user',
      content: '',
    }
    setPrompts([...prompts, newPrompt])
  }

  const handleUpdatePromptContent = (promptId: string, content: string) => {
    const updated = prompts.map((p) => (p.id === promptId ? { ...p, content } : p))
    setPrompts(updated)
  }

  const handleSave = () => {
    onUpdate(prompts)
    onClose()
  }

  const handleSaveNewTemplate = () => {
    if (!newTemplateName.trim() || !newTemplateContent.trim()) return

    const template = createTemplate(
      newTemplateName.trim(),
      newTemplateContent.trim(),
      newTemplateCategory,
      Object.keys(newTemplateVariables).length > 0 ? newTemplateVariables : undefined,
      newTemplateDescription.trim(),
    )

    addUserTemplate(template)
    setStoreTemplates(mergeTemplates(getPresetTemplates(), [...userTemplates, template]))

    // Reset form
    setEditingNewTemplate(false)
    setNewTemplateName('')
    setNewTemplateDescription('')
    setNewTemplateCategory('custom')
    setNewTemplateContent('')
    setNewTemplateVariables({})
  }

  // ------ Render ------

  return (
    <div data-testid="prompt-builder">
      {/* Header */}
      <div data-testid="prompt-builder-header">
        <h2>Prompt Builder</h2>
        <button data-testid="close-btn" onClick={onClose}>
          Close
        </button>
      </div>

      {/* Tab bar */}
      <div data-testid="tab-bar">
        <button
          data-testid="tab-chains"
          data-active={activeTab === 'chains'}
          onClick={() => setActiveTab('chains')}
        >
          Prompt Chain ({prompts.length})
        </button>
        <button
          data-testid="tab-templates"
          data-active={activeTab === 'templates'}
          onClick={() => setActiveTab('templates')}
        >
          Templates ({allTemplates.length})
        </button>
        <button
          data-testid="tab-variables"
          data-active={activeTab === 'variables'}
          onClick={() => setActiveTab('variables')}
        >
          Variables
        </button>
      </div>

      {/* Tab content */}
      <div data-testid="tab-content">
        {activeTab === 'chains' && (
          <div data-testid="chains-panel">
            {prompts.length === 0 && (
              <div data-testid="empty-chain">
                No prompts in chain. Select a template or add a custom prompt.
              </div>
            )}
            {prompts.map((prompt) => (
              <div key={prompt.id} data-testid={`chain-prompt-${prompt.id}`}>
                <div data-testid={`prompt-header-${prompt.id}`}>
                  <span>{prompt.templateName || prompt.type}</span>
                  <span>{prompt.source}</span>
                  <button
                    data-testid={`remove-prompt-${prompt.id}`}
                    onClick={() => handleRemovePrompt(prompt.id)}
                  >
                    Remove
                  </button>
                </div>
                {prompt.source === 'user' ? (
                  <textarea
                    data-testid={`prompt-content-${prompt.id}`}
                    value={prompt.content}
                    onChange={(e) => handleUpdatePromptContent(prompt.id, e.target.value)}
                    rows={4}
                  />
                ) : (
                  <div data-testid={`prompt-content-${prompt.id}`}>{prompt.content}</div>
                )}
              </div>
            ))}
            <button data-testid="add-custom-prompt" onClick={handleAddCustomPrompt}>
              Add Custom Prompt
            </button>
          </div>
        )}

        {activeTab === 'templates' && (
          <div data-testid="templates-panel">
            {editingNewTemplate ? (
              <div data-testid="new-template-form">
                <h3>New Template</h3>
                <div>
                  <label>Name</label>
                  <input
                    data-testid="new-template-name"
                    type="text"
                    value={newTemplateName}
                    onChange={(e) => setNewTemplateName(e.target.value)}
                  />
                </div>
                <div>
                  <label>Description</label>
                  <input
                    data-testid="new-template-description"
                    type="text"
                    value={newTemplateDescription}
                    onChange={(e) => setNewTemplateDescription(e.target.value)}
                  />
                </div>
                <div>
                  <label>Category</label>
                  <select
                    data-testid="new-template-category"
                    value={newTemplateCategory}
                    onChange={(e) => setNewTemplateCategory(e.target.value)}
                  >
                    <option value="coding">Coding</option>
                    <option value="planning">Planning</option>
                    <option value="general">General</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                <div>
                  <label>Prompt Content</label>
                  <textarea
                    data-testid="new-template-content"
                    value={newTemplateContent}
                    onChange={(e) => setNewTemplateContent(e.target.value)}
                    rows={8}
                  />
                </div>
                <VariableEditor variables={newTemplateVariables} onChange={setNewTemplateVariables} />
                <div>
                  <button data-testid="save-new-template" onClick={handleSaveNewTemplate}>
                    Save Template
                  </button>
                  <button data-testid="cancel-new-template" onClick={() => setEditingNewTemplate(false)}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div data-testid="template-actions">
                  <button data-testid="create-template-btn" onClick={() => setEditingNewTemplate(true)}>
                    New Template
                  </button>
                </div>
                <TemplateList
                  templates={allTemplates}
                  onSelect={handleSelectTemplate}
                  selectedId={selectedTemplateId ?? undefined}
                />
                {selectedTemplate && (
                  <div data-testid="template-preview">
                    <h3>{selectedTemplate.name}</h3>
                    <p>{selectedTemplate.description}</p>
                    {selectedTemplate.variables &&
                      Object.keys(selectedTemplate.variables).length > 0 && (
                        <VariableInput
                          template={selectedTemplate}
                          values={templateValues}
                          onChange={setTemplateValues}
                        />
                      )}
                    <div data-testid="template-prompt-preview">
                      {selectedTemplate.variables &&
                      Object.keys(selectedTemplate.variables).length > 0
                        ? fillVersionedTemplate(selectedTemplate, templateValues)
                        : selectedTemplate.prompt}
                    </div>
                    <button data-testid="apply-template" onClick={handleApplyTemplate}>
                      Apply to Chain
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {activeTab === 'variables' && (
          <div data-testid="variables-panel">
            <p>
              Variables can be used in templates via <code>{'{{variableName}}'}</code> syntax.
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div data-testid="prompt-builder-footer">
        <span>{prompts.length} prompts in chain</span>
        <button data-testid="cancel-btn" onClick={onClose}>
          Cancel
        </button>
        <button data-testid="apply-chain-btn" onClick={handleSave}>
          Apply Chain ({prompts.length})
        </button>
      </div>
    </div>
  )
}
