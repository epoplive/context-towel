import type { BlockParseError } from './types'

type FormFieldOption = {
  id: string
  label: string
}

type FormFieldCondition = {
  field: string
  is?: string | number | boolean
  in?: Array<string | number | boolean>
}

type FormField = {
  id: string
  label?: string
  type: string
  required?: boolean
  placeholder?: string
  options?: FormFieldOption[]
  when?: FormFieldCondition
}

type FormStep = {
  id: string
  title?: string
  description?: string
  fields: FormField[]
  when?: FormFieldCondition
}

type FormActionApproval = {
  required?: boolean
  allowlist?: Array<{ type: string; value: string }>
}

type FormAction = {
  target: 'none' | 'api' | 'tool' | 'local'
  request?: Record<string, unknown>
  approval?: FormActionApproval
}

type FormPersistence = {
  mode: 'inline' | 'external'
  path: string
  mergeStrategy: 'merge' | 'replace'
}

type FormValidationRule = {
  field: string
  type: string
}

export type ResultFieldMapping = {
  field: string
  label: string
  type?: 'text' | 'link' | 'badge' | 'code' | 'image'
}

export type FormResults = {
  display?: 'below' | 'side' | 'inline'
  format?: 'json' | 'table' | 'card'
  mapping?: ResultFieldMapping[]
  refreshInterval?: number
  onSuccess?: string
  onError?: string
}

export type FormLastResult = {
  status: number
  data: unknown
  timestamp: string
  error?: string
}

export type FormBlockData = {
  schemaVersion?: number
  id?: string
  title?: string
  description?: string
  mode?: 'single' | 'multi-step'
  steps?: FormStep[]
  responses?: Record<string, unknown>
  actions?: { onSubmit?: FormAction }
  persistence?: Partial<FormPersistence>
  validation?: { mode?: 'strict' | 'warn'; rules?: FormValidationRule[] }
  results?: FormResults
  lastResult?: FormLastResult
}

const FIELD_TYPES = new Set([
  'text',
  'email',
  'tel',
  'number',
  'textarea',
  'select',
  'multiselect',
  'checkbox',
  'date',
  'file',
  'custom',
])

const ACTION_TARGETS = new Set(['none', 'api', 'tool', 'local'])
const RESULT_DISPLAYS = new Set(['below', 'side', 'inline'])
const RESULT_FORMATS = new Set(['json', 'table', 'card'])
const RESULT_FIELD_TYPES = new Set(['text', 'link', 'badge', 'code', 'image'])
const PERSISTENCE_MODES = new Set(['inline', 'external'])
const MERGE_STRATEGIES = new Set(['merge', 'replace'])
const VALIDATION_MODES = new Set(['strict', 'warn'])

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

export function validateFormBlock(data: unknown): BlockParseError[] {
  const errors: BlockParseError[] = []
  if (!isObject(data)) {
    errors.push({ message: 'Form block must be a YAML mapping (object).' })
    return errors
  }

  if (data.schemaVersion !== undefined && typeof data.schemaVersion !== 'number') {
    errors.push({ message: 'schemaVersion must be a number.' })
  }

  const steps = data.steps
  if (!Array.isArray(steps) || steps.length === 0) {
    errors.push({ message: 'steps must be a non-empty array.' })
  } else {
    steps.forEach((step, stepIndex) => {
      if (!isObject(step)) {
        errors.push({ message: `steps[${stepIndex}] must be an object.` })
        return
      }
      if (!isNonEmptyString(step.id)) {
        errors.push({ message: `steps[${stepIndex}].id is required.` })
      }
      if (!Array.isArray(step.fields) || step.fields.length === 0) {
        errors.push({ message: `steps[${stepIndex}].fields must be a non-empty array.` })
      } else {
        step.fields.forEach((field, fieldIndex) => {
          if (!isObject(field)) {
            errors.push({ message: `steps[${stepIndex}].fields[${fieldIndex}] must be an object.` })
            return
          }
          if (!isNonEmptyString(field.id)) {
            errors.push({ message: `steps[${stepIndex}].fields[${fieldIndex}].id is required.` })
          }
          if (!isNonEmptyString(field.type) || !FIELD_TYPES.has(field.type)) {
            errors.push({ message: `steps[${stepIndex}].fields[${fieldIndex}].type is invalid.` })
          }
          if ((field.type === 'select' || field.type === 'multiselect') && field.options) {
            if (!Array.isArray(field.options) || field.options.length === 0) {
              errors.push({ message: `steps[${stepIndex}].fields[${fieldIndex}].options must be a non-empty array.` })
            } else {
              field.options.forEach((option, optionIndex) => {
                if (!isObject(option)) {
                  errors.push({ message: `steps[${stepIndex}].fields[${fieldIndex}].options[${optionIndex}] must be an object.` })
                  return
                }
                if (!isNonEmptyString(option.id) || !isNonEmptyString(option.label)) {
                  errors.push({ message: `steps[${stepIndex}].fields[${fieldIndex}].options[${optionIndex}] requires id and label.` })
                }
              })
            }
          }
        })
      }
    })
  }

  if (data.mode && data.mode !== 'single' && data.mode !== 'multi-step') {
    errors.push({ message: 'mode must be "single" or "multi-step".' })
  }

  if (data.actions && isObject(data.actions) && data.actions.onSubmit) {
    const action = data.actions.onSubmit
    if (!isObject(action)) {
      errors.push({ message: 'actions.onSubmit must be an object.' })
    } else {
      if (!isNonEmptyString(action.target) || !ACTION_TARGETS.has(action.target)) {
        errors.push({ message: 'actions.onSubmit.target must be one of none|api|tool|local.' })
      }
      if (action.target === 'api') {
        const request = action.request
        if (!isObject(request)) {
          errors.push({ message: 'actions.onSubmit.request must be an object for api targets.' })
        } else {
          if (!isNonEmptyString(request.url)) {
            errors.push({ message: 'actions.onSubmit.request.url is required for api targets.' })
          }
          if (request.method && typeof request.method !== 'string') {
            errors.push({ message: 'actions.onSubmit.request.method must be a string.' })
          }
        }
      }
    }
  }

  if (data.persistence && isObject(data.persistence)) {
    const persistence = data.persistence
    if (typeof persistence.mode === 'string' && !PERSISTENCE_MODES.has(persistence.mode)) {
      errors.push({ message: 'persistence.mode must be inline or external.' })
    }
    if (typeof persistence.mergeStrategy === 'string' && !MERGE_STRATEGIES.has(persistence.mergeStrategy)) {
      errors.push({ message: 'persistence.mergeStrategy must be merge or replace.' })
    }
    if (persistence.path && typeof persistence.path !== 'string') {
      errors.push({ message: 'persistence.path must be a string.' })
    }
  }

  if (data.validation && isObject(data.validation)) {
    const validation = data.validation
    if (typeof validation.mode === 'string' && !VALIDATION_MODES.has(validation.mode)) {
      errors.push({ message: 'validation.mode must be strict or warn.' })
    }
    if (validation.rules && !Array.isArray(validation.rules)) {
      errors.push({ message: 'validation.rules must be an array.' })
    }
  }

  if (data.results && isObject(data.results)) {
    const results = data.results
    if (typeof results.display === 'string' && !RESULT_DISPLAYS.has(results.display)) {
      errors.push({ message: 'results.display must be below|side|inline.' })
    }
    if (typeof results.format === 'string' && !RESULT_FORMATS.has(results.format)) {
      errors.push({ message: 'results.format must be json|table|card.' })
    }
    if (results.mapping && Array.isArray(results.mapping)) {
      (results.mapping as Array<unknown>).forEach((m, i) => {
        if (!isObject(m)) {
          errors.push({ message: `results.mapping[${i}] must be an object.` })
        } else {
          if (!isNonEmptyString(m.field)) {
            errors.push({ message: `results.mapping[${i}].field is required.` })
          }
          if (!isNonEmptyString(m.label)) {
            errors.push({ message: `results.mapping[${i}].label is required.` })
          }
          if (typeof m.type === 'string' && !RESULT_FIELD_TYPES.has(m.type)) {
            errors.push({ message: `results.mapping[${i}].type must be text|link|badge|code|image.` })
          }
        }
      })
    }
    if (results.refreshInterval !== undefined && typeof results.refreshInterval !== 'number') {
      errors.push({ message: 'results.refreshInterval must be a number.' })
    }
  }

  return errors
}

export function normalizeFormBlock(data: FormBlockData): FormBlockData {
  return {
    schemaVersion: typeof data.schemaVersion === 'number' ? data.schemaVersion : 1,
    id: data.id,
    title: data.title,
    description: data.description,
    mode: data.mode === 'multi-step' ? 'multi-step' : 'single',
    steps: Array.isArray(data.steps) ? data.steps : [],
    responses: isObject(data.responses) ? data.responses : {},
    actions: data.actions,
    persistence: {
      mode: data.persistence?.mode && PERSISTENCE_MODES.has(data.persistence.mode)
        ? data.persistence.mode
        : 'inline',
      path: typeof data.persistence?.path === 'string' ? data.persistence.path : 'responses',
      mergeStrategy: data.persistence?.mergeStrategy && MERGE_STRATEGIES.has(data.persistence.mergeStrategy)
        ? data.persistence.mergeStrategy
        : 'merge',
    },
    validation: {
      mode: data.validation?.mode && VALIDATION_MODES.has(data.validation.mode)
        ? data.validation.mode
        : 'strict',
      rules: Array.isArray(data.validation?.rules) ? data.validation.rules : [],
    },
    results: data.results,
    lastResult: data.lastResult,
  }
}
