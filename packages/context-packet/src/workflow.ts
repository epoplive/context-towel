/**
 * Workflow Schema — parses workflow.md and evaluates stage completion.
 *
 * workflow.md is the declarative schema that defines a packet's structure:
 * - What folders exist
 * - What stages the work goes through
 * - What each stage inputs/outputs
 * - What gates define "done" for each stage
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/** Field validation rule for a typed block */
export interface BlockFieldRequirement {
  /** Field name to validate */
  field: string
  /** Whether the field must be present */
  required: boolean
  /** Expected value type */
  type?: 'string' | 'array' | 'hex-color' | 'url' | 'enum'
  /** Valid values for enum type */
  enumValues?: string[]
  /** Minimum string length */
  minLength?: number
  /** Minimum array item count */
  minItems?: number
  /** Regex pattern the value must match */
  pattern?: RegExp
  /** Field value must be unique across all blocks of this type */
  unique?: boolean
  /** Field value must reference another block type's field (e.g., 'sitepage.pageKey') */
  refExists?: string
}

/** Defines what a valid document of a given format looks like */
export interface FormatDefinition {
  /** Format name (referenced by outputs) */
  name: string
  /** Required markdown heading sections (case-insensitive match) */
  requiredSections?: string[]
  /** Required block types (e.g. 'question', 'task', 'checklist') */
  requiredBlocks?: string[]
  /** Minimum number of instances for each required block type */
  requiredBlockCounts?: Record<string, number>
  /** Per-block-type field validation rules */
  blockFieldRequirements?: Record<string, BlockFieldRequirement[]>
  /** Custom validator function (registered programmatically, not from YAML) */
  validate?: (content: string) => FormatValidationResult
}

export interface FormatValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

export interface WorkflowGate {
  /** Gate type: how to check completion */
  type: 'questions-answered' | 'checklist-complete' | 'file-exists' | 'format-valid' | 'custom'
  /** Scope: glob pattern or file path for which files to check */
  scope: string
  /** Format name to validate against (for type: format-valid) */
  format?: string
  /** Custom expression (for type: custom) */
  expression?: string
}

export interface WorkflowOutput {
  /** Expected file path (may contain {variables}) */
  path: string
  /** Format reference (what kind of doc this should be) */
  format?: string
}

export interface WorkflowStage {
  /** Stage name */
  name: string
  /** What this stage needs (references to previous outputs or external data) */
  inputs: string[]
  /** What this stage produces */
  outputs: WorkflowOutput[]
  /** Completion gates */
  gates: WorkflowGate[]
  /** Repeat rule: iterate over items (e.g. "for each page in strategy/sitemap.md") */
  repeat?: string
}

export interface WorkflowStructureEntry {
  /** Folder path */
  path: string
  /** Description of what goes here */
  description: string
}

export interface WorkflowSchema {
  /** Workflow name/title */
  name: string
  /** Folder structure declarations */
  structure: WorkflowStructureEntry[]
  /** Format definitions — what valid documents look like */
  formats: Map<string, FormatDefinition>
  /** Ordered stages */
  stages: WorkflowStage[]
}

export interface StageStatus {
  name: string
  /** Which gates passed */
  gatesPassed: number
  /** Total gates */
  gatesTotal: number
  /** Whether all gates pass */
  complete: boolean
  /** Details per gate */
  gateDetails: Array<{
    gate: WorkflowGate
    passed: boolean
    detail: string
  }>
}

// ─── Parser ───────────────────────────────────────────────────────────────────

/**
 * Parse a workflow.md file into a WorkflowSchema.
 * Format is markdown with YAML-ish structure under headings.
 */
export function parseWorkflow(content: string): WorkflowSchema {
  const name = content.match(/^#\s+Workflow:\s*(.+)/m)?.[1]?.trim() ?? 'Unnamed'

  // Parse structure section
  const structure: WorkflowStructureEntry[] = []
  const structureSection = content.match(/## Structure\s*\n([\s\S]*?)(?=\n## |\n# |$)/)?.[1] ?? ''
  for (const line of structureSection.split('\n')) {
    const match = line.match(/^-\s+(\S+)\s+[—–-]\s+(.+)/)
    if (match) {
      structure.push({ path: match[1].replace(/\/$/, ''), description: match[2].trim() })
    }
  }

  // Parse formats section
  const formats = new Map<string, FormatDefinition>()
  const formatsSection = content.match(/## Formats\s*\n([\s\S]*?)(?=\n## [^#]|\n# |$)/)?.[1] ?? ''
  const formatPattern = /### (\w[\w-]*)\s*\n([\s\S]*?)(?=\n### |\n## |$)/g
  let formatMatch: RegExpExecArray | null
  while ((formatMatch = formatPattern.exec(formatsSection)) !== null) {
    const formatName = formatMatch[1]
    const formatBody = formatMatch[2]

    const requiredSections: string[] = []
    const sectionsLine = formatBody.match(/required-sections:\s*\[([^\]]*)\]/)?.[1]
    if (sectionsLine) {
      requiredSections.push(...sectionsLine.split(',').map(s => s.trim()).filter(Boolean))
    }

    const requiredBlocks: string[] = []
    const blocksLine = formatBody.match(/required-blocks:\s*\[([^\]]*)\]/)?.[1]
    if (blocksLine) {
      requiredBlocks.push(...blocksLine.split(',').map(s => s.trim()).filter(Boolean))
    }

    const requiredBlockCounts: Record<string, number> = {}
    const countsPattern = /required-block-counts:\s*\n((?:\s+\w[\w-]*:\s*\d+\n?)*)/
    const countsMatch = formatBody.match(countsPattern)
    if (countsMatch) {
      for (const line of countsMatch[1].split('\n')) {
        const cm = line.match(/^\s+(\w[\w-]*):\s*(\d+)/)
        if (cm) requiredBlockCounts[cm[1]] = parseInt(cm[2], 10)
      }
    }

    formats.set(formatName, {
      name: formatName,
      requiredSections: requiredSections.length > 0 ? requiredSections : undefined,
      requiredBlocks: requiredBlocks.length > 0 ? requiredBlocks : undefined,
      requiredBlockCounts: Object.keys(requiredBlockCounts).length > 0 ? requiredBlockCounts : undefined,
    })
  }

  // Parse stages section
  const stages: WorkflowStage[] = []
  const stagesSection = content.match(/## Stages\s*\n([\s\S]*?)(?=\n## [^#]|\n# |$)/)?.[1] ?? ''

  const stagePattern = /### (\w[\w-]*)\s*\n([\s\S]*?)(?=\n### |\n## |$)/g
  let stageMatch: RegExpExecArray | null
  while ((stageMatch = stagePattern.exec(stagesSection)) !== null) {
    const stageName = stageMatch[1]
    const stageBody = stageMatch[2]

    const inputs: string[] = []
    const inputsLine = stageBody.match(/^inputs:\s*(.+)/m)?.[1]?.trim()
    if (inputsLine) {
      // Parse: [item1, item2] or comma-separated
      const cleaned = inputsLine.replace(/^\[|\]$/g, '')
      inputs.push(...cleaned.split(',').map(s => s.trim()).filter(Boolean))
    }

    const outputs: WorkflowOutput[] = []
    const outputsSection = stageBody.match(/outputs:\s*\n((?:\s+-[^\n]*\n?)*)/)?.[1] ?? ''
    for (const line of outputsSection.split('\n')) {
      const outMatch = line.match(/^\s+-\s+(?:path:\s*)?(\S+?)(?:\s+\(format:\s*(\S+?)\))?$/)
      if (outMatch) {
        outputs.push({ path: outMatch[1], format: outMatch[2] })
      }
    }

    const gates: WorkflowGate[] = []
    const gatesSection = stageBody.match(/gates:\s*\n((?:\s+-[^\n]*\n?)*)/)?.[1] ?? ''
    for (const line of gatesSection.split('\n')) {
      const gateMatch = line.match(/^\s+-\s+(?:type:\s*)?(\S+)\s*(?:scope:\s*)?(.+)?/)
      if (gateMatch) {
        // Try structured: "type: questions-answered scope: discovery/*.md"
        const typeStr = gateMatch[1]
        const scopeStr = gateMatch[2]?.trim() ?? ''

        // Also handle natural language gates
        if (typeStr === 'all' && scopeStr.includes('questions')) {
          const scopeMatch = scopeStr.match(/in\s+(\S+)\s+answered/)
          gates.push({
            type: 'questions-answered',
            scope: scopeMatch?.[1] ?? '*',
          })
        } else if (typeStr === 'checklist' || scopeStr.includes('checklist')) {
          const scopeMatch = scopeStr.match(/in\s+(\S+)\s+complete/) ?? scopeStr.match(/(\S+)/)
          gates.push({
            type: 'checklist-complete',
            scope: scopeMatch?.[1] ?? '*',
          })
        } else if (typeStr === 'format-valid') {
          // format-valid <path> <format-name>
          const parts = scopeStr.split(/\s+/)
          gates.push({
            type: 'format-valid',
            scope: parts[0] ?? '*',
            format: parts[1],
          })
        } else if (['questions-answered', 'checklist-complete', 'file-exists'].includes(typeStr)) {
          gates.push({
            type: typeStr as WorkflowGate['type'],
            scope: scopeStr,
          })
        } else {
          gates.push({
            type: 'custom',
            scope: '*',
            expression: line.trim().replace(/^\s*-\s*/, ''),
          })
        }
      }
    }

    const repeat = stageBody.match(/^repeat:\s*(.+)/m)?.[1]?.trim()

    stages.push({ name: stageName, inputs, outputs, gates, repeat })
  }

  // Auto-generate format-valid gates from outputs that have format references
  for (const stage of stages) {
    for (const output of stage.outputs) {
      if (output.format && formats.has(output.format)) {
        // Add format-valid gate if not already present
        const hasFormatGate = stage.gates.some(g =>
          g.type === 'format-valid' && g.scope === output.path && g.format === output.format
        )
        if (!hasFormatGate) {
          stage.gates.push({
            type: 'format-valid',
            scope: output.path,
            format: output.format,
          })
        }
      }
    }
  }

  return { name, structure, formats, stages }
}

// ─── Gate Evaluation ──────────────────────────────────────────────────────────

export interface GateEvalContext {
  /** Read a file's content */
  readFile: (path: string) => Promise<string | null>
  /** Check if a file exists */
  fileExists: (path: string) => Promise<boolean>
  /** List files matching a glob-like pattern */
  listFiles: (pattern: string) => Promise<string[]>
  /** Format definitions from workflow schema */
  formats?: Map<string, FormatDefinition>
}

/**
 * Evaluate a single gate against the packet's current state.
 */
export async function evaluateGate(
  gate: WorkflowGate,
  ctx: GateEvalContext,
): Promise<{ passed: boolean; detail: string }> {
  switch (gate.type) {
    case 'file-exists': {
      const exists = await ctx.fileExists(gate.scope)
      return {
        passed: exists,
        detail: exists ? `${gate.scope} exists` : `${gate.scope} missing`,
      }
    }

    case 'questions-answered': {
      const files = await ctx.listFiles(gate.scope)
      let totalQuestions = 0
      let answeredQuestions = 0

      for (const file of files) {
        const content = await ctx.readFile(file)
        if (!content) continue

        // Count ~~~question blocks
        const questionPattern = /~~~question\s*\n[\s\S]*?~~~/g
        let qMatch: RegExpExecArray | null
        while ((qMatch = questionPattern.exec(content)) !== null) {
          totalQuestions++
          // A question is "answered" if it has a response/answer field
          if (qMatch[0].includes('response:') || qMatch[0].includes('answer:')) {
            answeredQuestions++
          }
        }
      }

      const passed = totalQuestions === 0 || answeredQuestions === totalQuestions
      return {
        passed,
        detail: totalQuestions === 0
          ? 'No questions found'
          : `${answeredQuestions}/${totalQuestions} questions answered`,
      }
    }

    case 'checklist-complete': {
      const files = await ctx.listFiles(gate.scope)
      let totalItems = 0
      let checkedItems = 0

      for (const file of files) {
        const content = await ctx.readFile(file)
        if (!content) continue

        // Count markdown checklist items: - [ ] and - [x]
        const unchecked = (content.match(/- \[ \]/g) ?? []).length
        const checked = (content.match(/- \[x\]/gi) ?? []).length
        totalItems += unchecked + checked
        checkedItems += checked
      }

      const passed = totalItems > 0 && checkedItems === totalItems
      return {
        passed,
        detail: totalItems === 0
          ? 'No checklist items found'
          : `${checkedItems}/${totalItems} items checked`,
      }
    }

    case 'format-valid': {
      const formatName = gate.format
      if (!formatName) {
        return { passed: false, detail: 'No format specified for format-valid gate' }
      }

      const formatDef = ctx.formats?.get(formatName)
      if (!formatDef) {
        return { passed: false, detail: `Format "${formatName}" not defined` }
      }

      const content = await ctx.readFile(gate.scope)
      if (!content) {
        return { passed: false, detail: `${gate.scope} not found` }
      }

      // Run custom validator if registered
      if (formatDef.validate) {
        const result = formatDef.validate(content)
        return {
          passed: result.valid,
          detail: result.valid
            ? `${gate.scope} matches format ${formatName}`
            : result.errors.join('; '),
        }
      }

      // Check required sections (headings)
      const errors: string[] = []
      if (formatDef.requiredSections) {
        for (const section of formatDef.requiredSections) {
          const headingPattern = new RegExp(`^#{1,6}\\s+${escapeRegex(section)}\\s*$`, 'im')
          if (!headingPattern.test(content)) {
            errors.push(`Missing section: ${section}`)
          }
        }
      }

      // Check required blocks and validate their content
      if (formatDef.requiredBlocks) {
        // Parse all blocks for cross-reference validation
        const allBlocksByType = new Map<string, Array<{ index: number; fields: Map<string, string> }>>()

        for (const blockType of formatDef.requiredBlocks) {
          const blockPattern = new RegExp(`~~~${escapeRegex(blockType)}\\s*\\n([\\s\\S]*?)~~~`, 'g')
          const matches = [...content.matchAll(blockPattern)]
          const count = matches.length
          const minCount = formatDef.requiredBlockCounts?.[blockType] ?? 1
          if (count < minCount) {
            errors.push(`Requires ${minCount} ${blockType} block(s), found ${count}`)
          }

          const parsedBlocks: Array<{ index: number; fields: Map<string, string> }> = []

          for (let i = 0; i < matches.length; i++) {
            const blockBody = matches[i]![1] ?? ''
            const fields = parseBlockFields(blockBody)
            parsedBlocks.push({ index: i, fields })

            // Basic content validation — reject undefined/null/empty
            for (const [fieldName, fieldValue] of fields) {
              if (fieldValue === 'undefined' || fieldValue === 'null' || fieldValue === '""' || fieldValue === "''") {
                errors.push(`${blockType} #${i + 1}: "${fieldName}" has invalid value "${fieldValue}"`)
              }
            }

            // Option validation (for question blocks with options)
            const optionIds = [...blockBody.matchAll(/- id:\s*"([^"]*)"/g)]
            for (const optId of optionIds) {
              if (optId[1] === 'undefined' || optId[1] === '') {
                errors.push(`${blockType} #${i + 1}: option has undefined/empty id`)
              }
            }
            const optionLabels = [...blockBody.matchAll(/label:\s*"([^"]*)"/g)]
            for (const optLabel of optionLabels) {
              if (optLabel[1] === '') {
                errors.push(`${blockType} #${i + 1}: option has empty label`)
              }
            }
          }

          allBlocksByType.set(blockType, parsedBlocks)

          // Field requirement validation
          const fieldReqs = formatDef.blockFieldRequirements?.[blockType]
          if (fieldReqs) {
            const seenValues = new Map<string, Set<string>>() // for uniqueness checks

            for (const block of parsedBlocks) {
              for (const req of fieldReqs) {
                const value = block.fields.get(req.field)
                const unquoted = value ? value.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1') : undefined
                const label = `${blockType} #${block.index + 1}`

                // Required check
                if (req.required && (!unquoted || unquoted.length === 0)) {
                  errors.push(`${label}: missing required field "${req.field}"`)
                  continue
                }

                if (!unquoted || unquoted.length === 0) continue

                // Type checks
                if (req.type === 'hex-color' && !/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(unquoted)) {
                  errors.push(`${label}: "${req.field}" is not a valid hex color: "${unquoted}"`)
                }
                if (req.type === 'url' && !/^https?:\/\//.test(unquoted)) {
                  errors.push(`${label}: "${req.field}" is not a valid URL: "${unquoted}"`)
                }
                if (req.type === 'enum' && req.enumValues && !req.enumValues.includes(unquoted)) {
                  errors.push(`${label}: "${req.field}" must be one of [${req.enumValues.join(', ')}], got "${unquoted}"`)
                }

                // Min length
                if (req.minLength && unquoted.length < req.minLength) {
                  errors.push(`${label}: "${req.field}" too short (${unquoted.length} < ${req.minLength})`)
                }

                // Array checks
                if (req.type === 'array' || req.minItems) {
                  const arrayMatch = value?.match(/^\[(.+)\]$/)
                  const itemCount = arrayMatch ? arrayMatch[1]!.split(',').filter(s => s.trim().length > 0).length : 0
                  if (req.minItems && itemCount < req.minItems) {
                    errors.push(`${label}: "${req.field}" needs ${req.minItems}+ items, found ${itemCount}`)
                  }
                }

                // Uniqueness
                if (req.unique) {
                  if (!seenValues.has(req.field)) seenValues.set(req.field, new Set())
                  const seen = seenValues.get(req.field)!
                  if (seen.has(unquoted)) {
                    errors.push(`${label}: "${req.field}" value "${unquoted}" is not unique`)
                  }
                  seen.add(unquoted)
                }

                // Cross-reference (e.g., parentKey must reference a valid pageKey)
                if (req.refExists) {
                  const [refBlockType, refField] = req.refExists.split('.')
                  const refBlocks = allBlocksByType.get(refBlockType!) ?? []
                  const refValues = new Set(refBlocks.map(b => {
                    const v = b.fields.get(refField!)
                    return v ? v.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1') : ''
                  }))
                  if (!refValues.has(unquoted)) {
                    errors.push(`${label}: "${req.field}" references "${unquoted}" but no ${refBlockType} has ${refField}="${unquoted}"`)
                  }
                }
              }
            }
          }
        }
      }

      return {
        passed: errors.length === 0,
        detail: errors.length === 0
          ? `${gate.scope} matches format ${formatName}`
          : errors.join('; '),
      }
    }

    case 'custom': {
      return {
        passed: false,
        detail: `Custom gate not evaluated: ${gate.expression ?? gate.scope}`,
      }
    }
  }
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** Parse a block body into field name→value pairs */
function parseBlockFields(blockBody: string): Map<string, string> {
  const fields = new Map<string, string>()
  for (const line of blockBody.split('\n')) {
    const match = line.match(/^(\w[\w-]*):\s*(.*)$/)
    if (match) {
      fields.set(match[1]!, (match[2] ?? '').trim())
    }
  }
  return fields
}

/**
 * Evaluate all stages in a workflow schema.
 */
export async function evaluateWorkflow(
  schema: WorkflowSchema,
  ctx: GateEvalContext,
): Promise<StageStatus[]> {
  // Inject format definitions into the eval context
  const ctxWithFormats: GateEvalContext = { ...ctx, formats: schema.formats }
  const results: StageStatus[] = []

  for (const stage of schema.stages) {
    const gateDetails: StageStatus['gateDetails'] = []

    for (const gate of stage.gates) {
      const result = await evaluateGate(gate, ctxWithFormats)
      gateDetails.push({ gate, ...result })
    }

    const gatesPassed = gateDetails.filter(g => g.passed).length

    results.push({
      name: stage.name,
      gatesPassed,
      gatesTotal: stage.gates.length,
      complete: stage.gates.length > 0 && gatesPassed === stage.gates.length,
      gateDetails,
    })
  }

  return results
}
