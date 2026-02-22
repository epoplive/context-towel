/**
 * VariableInput - renders input controls for template variable values.
 *
 * Given a VersionedTemplate with variables, renders appropriate input
 * controls for each variable and reports value changes.
 */

import { useState, useEffect } from 'react'
import type { TemplateVariable, VersionedTemplate } from '../types'
import { fillVersionedTemplate } from '../services/template-registry'

export interface VariableInputProps {
  template: VersionedTemplate
  values: Record<string, unknown>
  onChange: (values: Record<string, unknown>) => void
  onPreview?: (filledPrompt: string) => void
}

export function VariableInput({ template, values, onChange, onPreview }: VariableInputProps) {
  const [localValues, setLocalValues] = useState<Record<string, unknown>>(values)

  useEffect(() => {
    // Initialize with default values
    const initialized = { ...values }
    if (template.variables) {
      for (const [name, config] of Object.entries(template.variables)) {
        if (initialized[name] === undefined && config.default !== undefined) {
          initialized[name] = config.default
        }
      }
    }
    setLocalValues(initialized)
    onChange(initialized)
    // Only re-run when template changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template.id])

  useEffect(() => {
    if (onPreview) {
      const filledPrompt = fillVersionedTemplate(template, localValues)
      onPreview(filledPrompt)
    }
  }, [localValues, template, onPreview])

  const updateValue = (name: string, value: unknown) => {
    const newValues = { ...localValues, [name]: value }
    setLocalValues(newValues)
    onChange(newValues)
  }

  const renderInput = (name: string, config: TemplateVariable) => {
    const value = localValues[name]

    switch (config.type) {
      case 'text':
        return (
          <input
            type="text"
            data-testid={`variable-input-${name}`}
            value={(value as string) || ''}
            onChange={(e) => updateValue(name, e.target.value)}
            placeholder={config.placeholder}
            required={config.required}
          />
        )

      case 'textarea':
        return (
          <textarea
            data-testid={`variable-input-${name}`}
            value={(value as string) || ''}
            onChange={(e) => updateValue(name, e.target.value)}
            placeholder={config.placeholder}
            required={config.required}
            rows={3}
          />
        )

      case 'select':
        return (
          <select
            data-testid={`variable-input-${name}`}
            value={(value as string) || ''}
            onChange={(e) => updateValue(name, e.target.value)}
            required={config.required}
          >
            {!config.required && <option value="">Select an option</option>}
            {(config.options || []).map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        )

      case 'number':
        return (
          <input
            type="number"
            data-testid={`variable-input-${name}`}
            value={(value as number) ?? ''}
            onChange={(e) => updateValue(name, e.target.valueAsNumber || '')}
            placeholder={config.placeholder}
            required={config.required}
            min={config.min}
            max={config.max}
          />
        )

      case 'boolean':
        return (
          <label>
            <input
              type="checkbox"
              data-testid={`variable-input-${name}`}
              checked={(value as boolean) || false}
              onChange={(e) => updateValue(name, e.target.checked)}
            />
            Enable {config.label}
          </label>
        )

      default:
        return null
    }
  }

  if (!template.variables || Object.keys(template.variables).length === 0) {
    return (
      <div data-testid="no-variables">
        <p>This template has no customizable variables.</p>
      </div>
    )
  }

  return (
    <div data-testid="variable-input">
      <h4>Customize Template</h4>
      <div>
        {Object.entries(template.variables).map(([name, config]) => (
          <div key={name} data-testid={`variable-field-${name}`}>
            <label>
              {config.label}
              {config.required && <span>*</span>}
            </label>
            {config.description && <p>{config.description}</p>}
            <div>{renderInput(name, config)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
