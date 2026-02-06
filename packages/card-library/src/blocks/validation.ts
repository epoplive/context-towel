import { parseDocument, isAlias, visit as visitYaml } from 'yaml'
import { blockRegistry } from './registry'
import type { BlockParseError } from './types'

export type BlockYamlValidation = {
  data: unknown | null
  errors: BlockParseError[]
}

const collectYamlErrors = (doc: ReturnType<typeof parseDocument>): BlockParseError[] => {
  const errors: BlockParseError[] = []
  if (doc.errors && doc.errors.length > 0) {
    doc.errors.forEach(err => {
      const pos = err.linePos?.[0]
      const line = pos?.line
      const column = pos?.col
      errors.push({
        message: err.message,
        line,
        column,
      })
    })
  }
  let hasAlias = false
  if (doc.contents) {
    visitYaml(doc.contents, (_key, node) => {
      if (isAlias(node)) {
        hasAlias = true
        return visitYaml.BREAK
      }
      return undefined
    })
  }
  if (hasAlias) {
    errors.push({
      message: 'YAML anchors/aliases are not supported in block data.',
    })
  }
  return errors
}

export function validateBlockYaml(type: string, yamlSource: string): BlockYamlValidation {
  const definition = blockRegistry.get(type)
  if (!definition) {
    return {
      data: null,
      errors: [{ message: `Unknown block type: ${type}` }],
    }
  }

  const doc = parseDocument(yamlSource)
  const errors = collectYamlErrors(doc)
  if (errors.length > 0) {
    return { data: null, errors }
  }

  const parsed = doc.toJS()
  let validationErrors: BlockParseError[] = []
  if (definition.validate) {
    validationErrors = definition.validate(parsed)
  } else if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    validationErrors = [{ message: 'Block data must be a YAML mapping (object).' }]
  }

  if (validationErrors.length > 0) {
    return { data: null, errors: validationErrors }
  }

  return { data: parsed, errors: [] }
}
