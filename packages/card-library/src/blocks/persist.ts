import { stringify as stringifyYaml, parseDocument, isAlias, visit as visitYaml } from 'yaml'
import type { BlockInstance, BlockParseError, BlockUpdate } from './types'
import type { RuntimePatch } from './runtime'
import { blockRegistry } from './registry'
import { formatFencedCodeBlock, getFencePreferenceFromRaw } from './fences'

export function serializeBlockData(data: unknown): string {
  return stringifyYaml(data, { lineWidth: 120, aliasDuplicateObjects: false }).trimEnd()
}

export function replaceBlockInMarkdown(content: string, block: BlockInstance, yamlText: string): string {
  const start = block.source.range.startOffset
  const end = block.source.range.endOffset
  if (typeof start !== 'number' || typeof end !== 'number') {
    return content
  }

  // Offset verification guard: ensure the content at [start, end) still matches
  // the original block source. After prose edits, offsets may be stale.
  if (block.source.raw) {
    const actual = content.slice(start, end)
    if (actual !== block.source.raw) {
      // Offsets are stale — bail out rather than corrupting the document
      return content
    }
  }

  const trimmedYaml = yamlText.trimEnd()
  const preference = typeof block.source.raw === 'string' ? getFencePreferenceFromRaw(block.source.raw) : {}
  const fenced = formatFencedCodeBlock(block.type, trimmedYaml, preference)
  return content.slice(0, start) + fenced + content.slice(end)
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

const extractYamlFromBlock = (raw: string): string => {
  const lines = raw.split('\n')
  if (lines.length <= 2) return ''
  return lines.slice(1, -1).join('\n')
}

export function updateBlockInMarkdown(
  content: string,
  block: BlockInstance,
  updates: BlockUpdate[]
): { content: string; errors: BlockParseError[] } {
  const definition = blockRegistry.get(block.type)

  // If the block definition has a custom applyUpdate, use it.
  // Block types with non-standard syntax (e.g. markdown checklists) implement this
  // to handle their own serialization instead of relying on generic YAML manipulation.
  if (definition?.applyUpdate && block.data !== null) {
    const { content: serialized, errors } = definition.applyUpdate(block.data, updates)
    if (errors.length > 0) {
      return { content, errors }
    }
    return {
      content: replaceBlockInMarkdown(content, block, serialized),
      errors: [],
    }
  }

  // Generic YAML path — parse, modify, serialize
  const yamlSource = extractYamlFromBlock(block.source.raw)
  const doc = parseDocument(yamlSource)
  const errors = collectYamlErrors(doc)
  if (errors.length > 0) {
    return { content, errors }
  }

  updates.forEach(update => {
    doc.setIn(update.path, update.value)
  })

  const updatedData = doc.toJS()
  const validationErrors = definition?.validate
    ? definition.validate(updatedData as any)
    : (updatedData === null || typeof updatedData !== 'object' || Array.isArray(updatedData))
      ? [{ message: 'Block data must be a YAML mapping (object).' }]
      : []
  if (validationErrors.length > 0) {
    return { content, errors: validationErrors }
  }

  const nextYaml = doc.toString().trimEnd()
  return {
    content: replaceBlockInMarkdown(content, block, nextYaml),
    errors: [],
  }
}

const mergeDeep = (target: any, source: any): any => {
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    return source
  }
  if (!target || typeof target !== 'object' || Array.isArray(target)) {
    target = {}
  }
  Object.keys(source).forEach(key => {
    const srcValue = source[key]
    const tgtValue = target[key]
    if (srcValue && typeof srcValue === 'object' && !Array.isArray(srcValue)) {
      target[key] = mergeDeep(tgtValue, srcValue)
    } else {
      target[key] = srcValue
    }
  })
  return target
}

export function applyRuntimePatchesToMarkdown(
  content: string,
  block: BlockInstance,
  patches: RuntimePatch[]
): { content: string; errors: BlockParseError[] } {
  const yamlSource = extractYamlFromBlock(block.source.raw)
  const doc = parseDocument(yamlSource)
  const errors = collectYamlErrors(doc)
  if (errors.length > 0) {
    return { content, errors }
  }

  patches.forEach(patch => {
    const path = patch.path ?? []
    if (patch.op === 'set') {
      if (path.length === 0) {
        doc.contents = doc.createNode(patch.value) as typeof doc.contents
      } else {
        doc.setIn(path, patch.value)
      }
    } else if (patch.op === 'merge') {
      const current = path.length === 0 ? doc.toJS() : doc.getIn(path)
      const merged = mergeDeep(current, patch.value)
      if (path.length === 0) {
        doc.contents = doc.createNode(merged) as typeof doc.contents
      } else {
        doc.setIn(path, merged)
      }
    } else if (patch.op === 'append') {
      const current = path.length === 0 ? doc.toJS() : doc.getIn(path)
      const values = Array.isArray(patch.value) ? patch.value : [patch.value]
      const next = Array.isArray(current) ? [...current, ...values] : [...values]
      if (path.length === 0) {
        doc.contents = doc.createNode(next) as typeof doc.contents
      } else {
        doc.setIn(path, next)
      }
    } else if (patch.op === 'unset') {
      if (path.length === 0) {
        doc.contents = doc.createNode(null) as typeof doc.contents
      } else {
        doc.deleteIn(path)
      }
    }
  })

  const nextYaml = doc.toString().trimEnd()
  return {
    content: replaceBlockInMarkdown(content, block, nextYaml),
    errors: [],
  }
}
