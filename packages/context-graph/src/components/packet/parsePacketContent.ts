// ============================================================================
// Shared Packet Content Parsing Utilities
//
// Extracted from PacketWorkspace.tsx so both PacketWorkspace and the
// PacketPanel sidebar can reuse the same parsing logic.
// ============================================================================

// ── Types ────────────────────────────────────────────────────────

export interface PacketSection {
  name: string
  content: string
  startLine: number
}

export interface VectorCriterionEntry {
  text: string
  mark: 'proven' | 'pending' | 'failed'
  proofRef?: string
}

export interface VectorFactEntry {
  text: string
  mark: 'established' | 'gap'
}

export interface ProblemVectorEntry {
  id: string
  state: string
  current: string
  target: string
  approach: string
  solvedCriteria?: VectorCriterionEntry[]
  problemFacts?: VectorFactEntry[]
}

export interface DeltaLogEntry {
  timestamp: string
  type: string
  nodeId?: string
  content: string
}

// ── Parsers ──────────────────────────────────────────────────────

/**
 * Split packet markdown into sections by `## ` headers.
 */
export function parsePacketSections(markdown: string): PacketSection[] {
  const sections: PacketSection[] = []
  const lines = markdown.split('\n')
  let currentSection: PacketSection | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const h2Match = line.match(/^## (.+)/)
    if (h2Match) {
      if (currentSection) {
        sections.push(currentSection)
      }
      currentSection = {
        name: h2Match[1].trim(),
        content: '',
        startLine: i + 1,
      }
    } else if (currentSection) {
      currentSection.content += line + '\n'
    }
  }
  if (currentSection) {
    sections.push(currentSection)
  }
  return sections
}

/**
 * Parse ## Problem Vectors section.
 * New format uses ### vectorId [state] entries with bold fields underneath.
 */
export function parseProblemVectors(sections: PacketSection[]): ProblemVectorEntry[] {
  const section = sections.find(s => s.name === 'Problem Vectors')
  if (!section) {
    // Fallback: try old-style single "Problem Vector" section
    const oldSection = sections.find(s => s.name === 'Problem Vector')
    if (!oldSection) return []

    const currentMatch = oldSection.content.match(/\*\*Current:\*\*\s*(.+)/)
    const targetMatch = oldSection.content.match(/\*\*Target:\*\*\s*(.+)/)
    const approachMatch = oldSection.content.match(/\*\*Approach:\*\*\s*(.+)/)
    const current = currentMatch?.[1]?.trim() ?? ''
    const target = targetMatch?.[1]?.trim() ?? ''
    const approach = approachMatch?.[1]?.trim() ?? ''
    if (!current && !target && !approach) return []
    return [{ id: 'default', state: 'open', current, target, approach }]
  }

  const vectors: ProblemVectorEntry[] = []
  // Match ### vectorId [state] headers
  const headerRe = /^###\s+(\S+)\s*\[([^\]]+)\]/gm
  let match: RegExpExecArray | null
  const headerPositions: Array<{ id: string; state: string; start: number }> = []

  while ((match = headerRe.exec(section.content)) !== null) {
    headerPositions.push({
      id: match[1],
      state: match[2].trim(),
      start: match.index + match[0].length,
    })
  }

  for (let i = 0; i < headerPositions.length; i++) {
    const hp = headerPositions[i]
    const end = i + 1 < headerPositions.length
      ? headerPositions[i + 1].start - headerPositions[i + 1].id.length - 10
      : section.content.length
    const body = section.content.slice(hp.start, end)

    const currentMatch = body.match(/\*\*Current:\*\*\s*(.+)/)
    const targetMatch = body.match(/\*\*Target:\*\*\s*(.+)/)
    const approachMatch = body.match(/\*\*Approach:\*\*\s*(.+)/)

    // Parse #### Solved Criteria subsection
    const solvedCriteria = parseCriteriaSubsection(body, 'Solved Criteria')
    // Parse #### Problem Facts subsection
    const problemFacts = parseFactSubsection(body, 'Problem Facts')

    vectors.push({
      id: hp.id,
      state: hp.state,
      current: currentMatch?.[1]?.trim() ?? '',
      target: targetMatch?.[1]?.trim() ?? '',
      approach: approachMatch?.[1]?.trim() ?? '',
      solvedCriteria: solvedCriteria.length > 0 ? solvedCriteria : undefined,
      problemFacts: problemFacts.length > 0 ? problemFacts : undefined,
    })
  }

  return vectors
}

/**
 * Parse ## Delta Log section. Entries are `- [timestamp] (type) content` or
 * `- [timestamp] (type) [nodeId] content`.
 */
export function parseDeltaLog(sections: PacketSection[]): DeltaLogEntry[] {
  const section = sections.find(s => s.name === 'Delta Log')
  if (!section) {
    // Fallback: try old "Session Log" format
    const oldSection = sections.find(s => s.name === 'Session Log')
    if (!oldSection) return []
    const entries: DeltaLogEntry[] = []
    const regex = /- \[([^\]]+)\]\s*(.+)/g
    let match: RegExpExecArray | null
    while ((match = regex.exec(oldSection.content)) !== null) {
      entries.push({ timestamp: match[1].trim(), type: 'log', content: match[2].trim() })
    }
    return entries
  }

  const entries: DeltaLogEntry[] = []

  // Engine format: - `timestamp` **type** [nodeId]: content
  const engineRegex = /- `([^`]+)`\s+\*\*([^*]+)\*\*\s*(?:\[([^\]]*)\])?\s*:?\s*(.+)/g
  // Old format: - [timestamp] (type) [nodeId] content
  const oldRegex = /- \[([^\]]+)\]\s*(?:\(([^)]*)\)\s*)?(?:\[([^\]]*)\]\s*)?(.+)/g

  let match: RegExpExecArray | null

  // Try engine format first
  while ((match = engineRegex.exec(section.content)) !== null) {
    entries.push({
      timestamp: match[1].trim(),
      type: match[2].trim(),
      nodeId: match[3]?.trim() || undefined,
      content: match[4].trim(),
    })
  }

  // If no engine-format entries found, try old format
  if (entries.length === 0) {
    while ((match = oldRegex.exec(section.content)) !== null) {
      entries.push({
        timestamp: match[1].trim(),
        type: match[2]?.trim() ?? 'log',
        nodeId: match[3]?.trim() || undefined,
        content: match[4].trim(),
      })
    }
  }

  return entries
}

// ── Criteria/Fact subsection parsers ────────────────────────────

/**
 * Parse a #### Solved Criteria subsection from vector body.
 * Format: - [x] text (proven by node-id) / - [ ] text / - [!] text
 */
function parseCriteriaSubsection(body: string, heading: string): VectorCriterionEntry[] {
  const headingRe = new RegExp(`####\\s+${heading}\\s*\\n([\\s\\S]*?)(?=\\n####|$)`)
  const sectionMatch = body.match(headingRe)
  if (!sectionMatch) return []

  const items: VectorCriterionEntry[] = []
  const lineRe = /^-\s*\[([^\]]*)\]\s*(.+)/gm
  let m: RegExpExecArray | null
  while ((m = lineRe.exec(sectionMatch[1])) !== null) {
    const marker = m[1].trim()
    let text = m[2].trim()

    let mark: 'proven' | 'pending' | 'failed'
    if (marker === 'x' || marker === 'X') mark = 'proven'
    else if (marker === '!') mark = 'failed'
    else mark = 'pending'

    // Extract proof ref: (proven by node-id)
    let proofRef: string | undefined
    const refMatch = text.match(/\(proven by ([^)]+)\)/)
    if (refMatch) {
      proofRef = refMatch[1].trim()
      text = text.replace(refMatch[0], '').trim()
    }

    items.push({ text, mark, proofRef })
  }
  return items
}

/**
 * Parse a #### Problem Facts subsection from vector body.
 * Format: - [established] text / - [gap] text
 */
function parseFactSubsection(body: string, heading: string): VectorFactEntry[] {
  const headingRe = new RegExp(`####\\s+${heading}\\s*\\n([\\s\\S]*?)(?=\\n####|$)`)
  const sectionMatch = body.match(headingRe)
  if (!sectionMatch) return []

  const items: VectorFactEntry[] = []
  const lineRe = /^-\s*\[([^\]]*)\]\s*(.+)/gm
  let m: RegExpExecArray | null
  while ((m = lineRe.exec(sectionMatch[1])) !== null) {
    const marker = m[1].trim().toLowerCase()
    const text = m[2].trim()

    const mark: 'established' | 'gap' = marker === 'gap' ? 'gap' : 'established'
    items.push({ text, mark })
  }
  return items
}
