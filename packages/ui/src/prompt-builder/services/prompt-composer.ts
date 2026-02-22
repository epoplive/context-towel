/**
 * Prompt composer service.
 *
 * Simplified version of Felix's PromptComposer. Composes a system prompt
 * from multiple parts (main prompt, context, rules, instructions).
 * No provider-capability logic - consumers control the composition.
 */

export interface PromptCompositionConfig {
  mainPrompt?: string
  contextFile?: string
  contextFilePath?: string
  additionalRules?: string[]
  additionalInstructions?: string[]
}

export interface PromptCompositionResult {
  systemPrompt: string
  userMessage: string
}

/**
 * Composes a system prompt from multiple parts.
 */
export function composePrompt(
  config: PromptCompositionConfig,
  userMessage: string,
): PromptCompositionResult {
  const messageText = typeof userMessage === 'string' ? userMessage : ''
  const parts: string[] = []

  const mainPrompt = normalizeBlock(config.mainPrompt)
  if (mainPrompt) {
    parts.push(mainPrompt)
  }

  const contextFile = normalizeBlock(config.contextFile)
  if (contextFile) {
    parts.push(`## Project Context\n${contextFile}`)
  }

  const rulesText = joinBlocks(config.additionalRules)
  if (rulesText) {
    parts.push(`## Additional Rules\n${rulesText}`)
  }

  const instructionsText = joinBlocks(config.additionalInstructions)
  if (instructionsText) {
    parts.push(`## Additional Instructions\n${instructionsText}`)
  }

  const systemPrompt = parts.join('\n\n').trim()

  return {
    systemPrompt,
    userMessage: messageText,
  }
}

/**
 * Builds a rules prompt from a list of code indexer rules.
 */
export function buildRulesPrompt(
  rules: Array<{ name: string; content?: string; priority?: number }>,
): string {
  const sorted = [...rules].sort((a, b) => (b.priority || 0) - (a.priority || 0))

  let prompt = '## Code Rules and Guidelines\n\n'
  prompt += 'Follow these specific rules for the code being discussed:\n\n'

  for (const rule of sorted) {
    prompt += `### ${rule.name}\n`
    prompt += `${rule.content || ''}\n\n`
  }

  prompt += 'Apply these rules contextually based on the specific code and problem being addressed.'

  return prompt
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeBlock(value?: string): string {
  if (typeof value !== 'string') return ''
  return value.trim()
}

function joinBlocks(values?: string[]): string {
  if (!Array.isArray(values) || values.length === 0) return ''
  return values
    .map((v) => normalizeBlock(v))
    .filter((v) => v.length > 0)
    .join('\n\n')
}
