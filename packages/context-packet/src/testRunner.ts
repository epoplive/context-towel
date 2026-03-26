// ============================================================================
// Test Runner — Execute test files and parse results into compact signals
//
// Runs vitest/jest on specified test files and returns structured results.
// Used by the CLI promote command to auto-verify work via connected test nodes.
// ============================================================================

import { execSync } from 'node:child_process'

export interface TestResult {
  path: string
  passed: number
  failed: number
  total: number
  /** First failure message (if any), truncated to fit in a delta */
  firstFailure?: string
  /** Compact one-line summary */
  summary: string
  /** Raw exit code */
  exitCode: number
}

export interface TestRunSummary {
  results: TestResult[]
  allPassed: boolean
  totalPassed: number
  totalFailed: number
  summary: string
}

/**
 * Detect test runner from file path and project context.
 * Returns the command to run a single test file.
 */
function detectTestCommand(testPath: string, cwd: string): string {
  // Check if vitest is available (preferred for this project)
  try {
    execSync('npx vitest --version', { cwd, encoding: 'utf-8', stdio: 'pipe' })
    return `npx vitest run ${testPath} --reporter=json`
  } catch {
    // Fall back to jest
    try {
      execSync('npx jest --version', { cwd, encoding: 'utf-8', stdio: 'pipe' })
      return `npx jest ${testPath} --json --no-coverage`
    } catch {
      // Last resort: just run it
      return `npx vitest run ${testPath} --reporter=json`
    }
  }
}

/**
 * Parse vitest JSON reporter output into TestResult.
 */
export function parseVitestJson(output: string, path: string): Omit<TestResult, 'exitCode'> | null {
  try {
    // vitest --reporter=json outputs JSON to stdout
    // Find the JSON object in the output (may have prefix text)
    const jsonStart = output.indexOf('{')
    if (jsonStart === -1) return null
    const jsonStr = output.slice(jsonStart)
    const data = JSON.parse(jsonStr)

    const passed = data.numPassedTests ?? 0
    const failed = data.numFailedTests ?? 0
    const total = data.numTotalTests ?? (passed + failed)

    let firstFailure: string | undefined
    if (data.testResults) {
      for (const suite of data.testResults) {
        if (suite.assertionResults) {
          const fail = suite.assertionResults.find((a: { status: string }) => a.status === 'failed')
          if (fail) {
            const msg = fail.failureMessages?.[0] ?? fail.title
            firstFailure = typeof msg === 'string' ? msg.split('\n')[0].slice(0, 200) : undefined
            break
          }
        }
      }
    }

    const summary = failed > 0
      ? `${passed} passed, ${failed} failed${firstFailure ? `: ${firstFailure.slice(0, 100)}` : ''}`
      : `${passed} passed`

    return { path, passed, failed, total, firstFailure, summary }
  } catch {
    return null
  }
}

/**
 * Parse vitest line output as fallback when JSON parsing fails.
 */
function parseVitestLines(output: string, path: string): Omit<TestResult, 'exitCode'> {
  // Look for summary line: "Tests  X passed (Y)" or "Tests  X failed | Y passed (Z)"
  const summaryMatch = output.match(/Tests?\s+(\d+)\s+passed/)
  const failedMatch = output.match(/(\d+)\s+failed/)

  const passed = summaryMatch ? parseInt(summaryMatch[1]) : 0
  const failed = failedMatch ? parseInt(failedMatch[1]) : 0
  const total = passed + failed

  // Extract first failure
  let firstFailure: string | undefined
  const failLine = output.match(/(?:FAIL|AssertionError|Error:)\s*(.+)/m)
  if (failLine) {
    firstFailure = failLine[1].slice(0, 200)
  }

  const summary = failed > 0
    ? `${passed} passed, ${failed} failed${firstFailure ? `: ${firstFailure.slice(0, 100)}` : ''}`
    : passed > 0
      ? `${passed} passed`
      : 'no tests found'

  return { path, passed, failed, total, firstFailure, summary }
}

/**
 * Run a single test file and return structured results.
 */
export function runTestFile(testPath: string, cwd: string): TestResult {
  const command = detectTestCommand(testPath, cwd)

  let output = ''
  let exitCode = 0

  try {
    output = execSync(command, {
      cwd,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 60_000,
    })
  } catch (err: unknown) {
    // Test failures cause non-zero exit — that's normal
    const execErr = err as { status?: number; stdout?: string; stderr?: string }
    exitCode = execErr.status ?? 1
    output = (execErr.stdout ?? '') + '\n' + (execErr.stderr ?? '')
  }

  // Try JSON parse first, fall back to line parsing
  const jsonResult = parseVitestJson(output, testPath)
  if (jsonResult) {
    return { ...jsonResult, exitCode }
  }

  const lineResult = parseVitestLines(output, testPath)
  return { ...lineResult, exitCode }
}

/**
 * Run multiple test files and return aggregated results.
 */
export function runTests(testPaths: string[], cwd: string): TestRunSummary {
  const results = testPaths.map(p => runTestFile(p, cwd))

  const totalPassed = results.reduce((sum, r) => sum + r.passed, 0)
  const totalFailed = results.reduce((sum, r) => sum + r.failed, 0)
  const allPassed = totalFailed === 0 && totalPassed > 0

  const summary = allPassed
    ? `${totalPassed} tests passed across ${results.length} files`
    : `${totalPassed} passed, ${totalFailed} failed across ${results.length} files`

  return { results, allPassed, totalPassed, totalFailed, summary }
}
