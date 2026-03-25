// ============================================================================
// Canary Verification — proves AI actually read and resolved linked files
// ============================================================================
//
// How it works:
// 1. Main instruction file (CLAUDE.md) declares a base verification symbol
// 2. Linked sub-files (.context/docs/*, .context/working/*) override the symbol
// 3. If AI responds with base symbol → didn't read sub-files
// 4. If AI responds with overridden symbol → correctly resolved
// 5. Wrong override → read files but resolved precedence wrong
//
// Multiple contracts verify different file categories independently.

/** A single verification contract */
export interface CanaryContract {
  /** Contract name (e.g. 'index', 'packet', 'docs') */
  name: string
  /** Base symbol declared in the main instruction file */
  baseSymbol: string
  /** Override symbol from a sub-file (null if no override active) */
  overrideSymbol: string | null
  /** Source file that declares the override */
  overrideSource: string | null
}

/** Full canary state for an instruction file */
export interface CanaryState {
  /** All active contracts */
  contracts: CanaryContract[]
  /** Timestamp when canary was generated */
  generatedAt: string
}

/**
 * Generate a deterministic canary symbol from a seed string.
 * Uses a simple hash so it's reproducible but not guessable.
 * The symbol is a short hex string prefixed with the contract name.
 */
export function generateCanarySymbol(contractName: string, seed: string): string {
  // Simple FNV-1a hash for deterministic, fast hashing
  let hash = 0x811c9dc5
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i)
    hash = (hash * 0x01000193) >>> 0
  }
  const hex = hash.toString(16).padStart(8, '0')
  return `${contractName}:${hex}`
}

/**
 * Build the canary section to inject into an instruction file.
 * Returns markdown that instructs the agent to echo the active symbol.
 */
export function buildCanarySection(state: CanaryState): string {
  if (state.contracts.length === 0) return ''

  const lines: string[] = [
    '## Verification Symbols',
    '',
    'Echo the following symbols when asked to verify context resolution.',
    'The correct symbol proves you read and resolved the linked files.',
    '',
  ]

  for (const contract of state.contracts) {
    const activeSymbol = contract.overrideSymbol ?? contract.baseSymbol
    lines.push(`- **${contract.name}:** \`${activeSymbol}\``)
  }

  return lines.join('\n')
}

/**
 * Build a canary override block for a sub-file.
 * This goes at the top of .context/ files to declare their override.
 */
export function buildCanaryOverride(contractName: string, overrideSymbol: string): string {
  return `<!-- canary:${contractName}=${overrideSymbol} -->`
}

/**
 * Parse canary overrides from file content.
 * Looks for <!-- canary:NAME=SYMBOL --> comments.
 */
export function parseCanaryOverrides(content: string): Map<string, string> {
  const overrides = new Map<string, string>()
  const pattern = /<!--\s*canary:(\w+)=(\S+)\s*-->/g
  let match: RegExpExecArray | null
  while ((match = pattern.exec(content)) !== null) {
    overrides.set(match[1], match[2])
  }
  return overrides
}

/**
 * Create the default canary state for a project.
 * Generates base symbols from the project path.
 */
export function createDefaultCanaryState(projectPath: string): CanaryState {
  return {
    contracts: [
      {
        name: 'index',
        baseSymbol: generateCanarySymbol('index', `${projectPath}/index`),
        overrideSymbol: null,
        overrideSource: null,
      },
      {
        name: 'packet',
        baseSymbol: generateCanarySymbol('packet', `${projectPath}/packet`),
        overrideSymbol: null,
        overrideSource: null,
      },
      {
        name: 'docs',
        baseSymbol: generateCanarySymbol('docs', `${projectPath}/docs`),
        overrideSymbol: null,
        overrideSource: null,
      },
    ],
    generatedAt: new Date().toISOString(),
  }
}

/**
 * Apply overrides from sub-files to the canary state.
 * Each override replaces the base symbol for its contract.
 * Last override wins (files processed in order).
 */
export function applyOverrides(
  state: CanaryState,
  overrides: Array<{ source: string; overrides: Map<string, string> }>,
): CanaryState {
  const contracts = state.contracts.map(c => ({ ...c }))

  for (const { source, overrides: fileOverrides } of overrides) {
    for (const [name, symbol] of fileOverrides) {
      const contract = contracts.find(c => c.name === name)
      if (contract) {
        contract.overrideSymbol = symbol
        contract.overrideSource = source
      }
    }
  }

  return { ...state, contracts }
}

/**
 * Verify an agent's echoed symbols against the expected state.
 * Returns which contracts passed, failed, or were missing.
 */
export function verifyCanary(
  state: CanaryState,
  echoed: Map<string, string>,
): Array<{ contract: string; status: 'pass' | 'fail' | 'missing'; expected: string; got: string | null }> {
  return state.contracts.map(contract => {
    const expected = contract.overrideSymbol ?? contract.baseSymbol
    const got = echoed.get(contract.name) ?? null

    if (got === null) {
      return { contract: contract.name, status: 'missing' as const, expected, got }
    }
    if (got === expected) {
      return { contract: contract.name, status: 'pass' as const, expected, got }
    }
    return { contract: contract.name, status: 'fail' as const, expected, got }
  })
}

// Managed section markers for canary
export const CANARY_START_MARKER = '<!-- CONTEXT_CANARY_START -->'
export const CANARY_END_MARKER = '<!-- CONTEXT_CANARY_END -->'
