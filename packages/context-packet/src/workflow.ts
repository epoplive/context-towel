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

export interface WorkflowGate {
  /** Gate type: how to check completion */
  type: 'questions-answered' | 'checklist-complete' | 'file-exists' | 'custom'
  /** Scope: glob pattern for which files to check */
  scope: string
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

  return { name, structure, stages }
}

// ─── Gate Evaluation ──────────────────────────────────────────────────────────

export interface GateEvalContext {
  /** Read a file's content */
  readFile: (path: string) => Promise<string | null>
  /** Check if a file exists */
  fileExists: (path: string) => Promise<boolean>
  /** List files matching a glob-like pattern */
  listFiles: (pattern: string) => Promise<string[]>
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

    case 'custom': {
      return {
        passed: false,
        detail: `Custom gate not evaluated: ${gate.expression ?? gate.scope}`,
      }
    }
  }
}

/**
 * Evaluate all stages in a workflow schema.
 */
export async function evaluateWorkflow(
  schema: WorkflowSchema,
  ctx: GateEvalContext,
): Promise<StageStatus[]> {
  const results: StageStatus[] = []

  for (const stage of schema.stages) {
    const gateDetails: StageStatus['gateDetails'] = []

    for (const gate of stage.gates) {
      const result = await evaluateGate(gate, ctx)
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
