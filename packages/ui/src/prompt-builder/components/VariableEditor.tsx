/**
 * VariableEditor - editor for defining template variables.
 *
 * Allows creating, editing, and deleting template variable definitions
 * that can be referenced in prompt templates via {{variableName}}.
 */

import { useState } from 'react'
import type { TemplateVariable } from '../types'

export interface VariableEditorProps {
  variables: Record<string, TemplateVariable>
  onChange: (variables: Record<string, TemplateVariable>) => void
}

export function VariableEditor({ variables, onChange }: VariableEditorProps) {
  const [editingVariable, setEditingVariable] = useState<string | null>(null)
  const [newVariable, setNewVariable] = useState<{
    name: string
    config: TemplateVariable
  }>({
    name: '',
    config: {
      type: 'text',
      label: '',
      description: '',
      default: '',
      required: false,
    },
  })

  const addVariable = () => {
    if (!newVariable.name.trim() || !newVariable.config.label.trim()) {
      return
    }

    if (variables[newVariable.name]) {
      return
    }

    onChange({
      ...variables,
      [newVariable.name]: { ...newVariable.config },
    })

    setNewVariable({
      name: '',
      config: {
        type: 'text',
        label: '',
        description: '',
        default: '',
        required: false,
      },
    })
  }

  const updateVariable = (name: string, config: TemplateVariable) => {
    onChange({ ...variables, [name]: config })
  }

  const deleteVariable = (name: string) => {
    const newVars = { ...variables }
    delete newVars[name]
    onChange(newVars)
  }

  return (
    <div data-testid="variable-editor">
      <h4>Template Variables</h4>
      <p>
        Define variables that users can customize when using this template. Use{' '}
        <code>{'{{variableName}}'}</code> in your prompt template.
      </p>

      <div>
        {Object.entries(variables).map(([name, config]) => (
          <div key={name} data-testid={`variable-item-${name}`}>
            {editingVariable === name ? (
              <div data-testid={`variable-editing-${name}`}>
                <div>
                  <label>Variable Name</label>
                  <input type="text" value={name} disabled />
                </div>
                <div>
                  <label>Type</label>
                  <select
                    value={config.type}
                    onChange={(e) =>
                      updateVariable(name, {
                        ...config,
                        type: e.target.value as TemplateVariable['type'],
                      })
                    }
                  >
                    <option value="text">Text Input</option>
                    <option value="textarea">Text Area</option>
                    <option value="select">Select Dropdown</option>
                    <option value="number">Number</option>
                    <option value="boolean">Checkbox</option>
                  </select>
                </div>
                <div>
                  <label>Label</label>
                  <input
                    type="text"
                    value={config.label}
                    onChange={(e) => updateVariable(name, { ...config, label: e.target.value })}
                    placeholder="User-friendly label"
                  />
                </div>
                <div>
                  <label>Description</label>
                  <input
                    type="text"
                    value={config.description || ''}
                    onChange={(e) =>
                      updateVariable(name, { ...config, description: e.target.value })
                    }
                    placeholder="Help text for the user"
                  />
                </div>
                {config.type === 'select' && (
                  <div>
                    <label>Options (one per line)</label>
                    <textarea
                      value={(config.options || []).join('\n')}
                      onChange={(e) =>
                        updateVariable(name, {
                          ...config,
                          options: e.target.value.split('\n').filter((o) => o.trim()),
                        })
                      }
                      rows={4}
                    />
                  </div>
                )}
                <div>
                  <label>Default Value</label>
                  {config.type === 'boolean' ? (
                    <label>
                      <input
                        type="checkbox"
                        checked={typeof config.default === 'boolean' ? config.default : false}
                        onChange={(e) =>
                          updateVariable(name, { ...config, default: e.target.checked })
                        }
                      />
                      Enabled by default
                    </label>
                  ) : (
                    <input
                      type={config.type === 'number' ? 'number' : 'text'}
                      value={typeof config.default === 'boolean' ? '' : (config.default ?? '')}
                      onChange={(e) =>
                        updateVariable(name, { ...config, default: e.target.value })
                      }
                      placeholder="Default value"
                    />
                  )}
                </div>
                <div>
                  <label>
                    <input
                      type="checkbox"
                      checked={config.required || false}
                      onChange={(e) =>
                        updateVariable(name, { ...config, required: e.target.checked })
                      }
                    />
                    Required
                  </label>
                </div>
                <button onClick={() => setEditingVariable(null)}>Done Editing</button>
              </div>
            ) : (
              <div data-testid={`variable-display-${name}`}>
                <div>
                  <span data-testid={`variable-name-${name}`}>{name}</span>
                  <span data-testid={`variable-type-${name}`}>{config.type}</span>
                  <button
                    data-testid={`variable-edit-btn-${name}`}
                    onClick={() => setEditingVariable(name)}
                  >
                    Edit
                  </button>
                  <button
                    data-testid={`variable-delete-btn-${name}`}
                    onClick={() => deleteVariable(name)}
                  >
                    Delete
                  </button>
                </div>
                <div>{config.label}</div>
                {config.description && <div>{config.description}</div>}
                {config.default !== undefined && config.default !== '' && (
                  <div>Default: {String(config.default)}</div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <div data-testid="add-variable-form">
        <h5>Add New Variable</h5>
        <div>
          <label>Variable Name</label>
          <input
            type="text"
            data-testid="new-variable-name"
            value={newVariable.name}
            onChange={(e) =>
              setNewVariable({
                ...newVariable,
                name: e.target.value.replace(/[^a-zA-Z0-9_]/g, ''),
              })
            }
            placeholder="variableName"
          />
        </div>
        <div>
          <label>Type</label>
          <select
            data-testid="new-variable-type"
            value={newVariable.config.type}
            onChange={(e) =>
              setNewVariable({
                ...newVariable,
                config: {
                  ...newVariable.config,
                  type: e.target.value as TemplateVariable['type'],
                },
              })
            }
          >
            <option value="text">Text Input</option>
            <option value="textarea">Text Area</option>
            <option value="select">Select Dropdown</option>
            <option value="number">Number</option>
            <option value="boolean">Checkbox</option>
          </select>
        </div>
        <div>
          <label>Label</label>
          <input
            type="text"
            data-testid="new-variable-label"
            value={newVariable.config.label}
            onChange={(e) =>
              setNewVariable({
                ...newVariable,
                config: { ...newVariable.config, label: e.target.value },
              })
            }
            placeholder="User-friendly label"
          />
        </div>
        <button data-testid="add-variable-btn" onClick={addVariable}>
          Add Variable
        </button>
      </div>
    </div>
  )
}
