import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as childProcess from 'node:child_process'

// Mock child_process before importing testRunner
vi.mock('node:child_process', () => ({
  execSync: vi.fn(),
}))

import { runTestFile, runTests } from '../../src/testRunner'

const mockExecSync = vi.mocked(childProcess.execSync)

const PASSING_JSON = JSON.stringify({
  numPassedTests: 3,
  numFailedTests: 0,
  numTotalTests: 3,
  testResults: [{
    name: 'auth.spec.ts',
    assertionResults: [
      { status: 'passed', title: 'authenticates' },
      { status: 'passed', title: 'refreshes' },
      { status: 'passed', title: 'validates' },
    ],
  }],
})

const FAILING_JSON = JSON.stringify({
  numPassedTests: 1,
  numFailedTests: 2,
  numTotalTests: 3,
  testResults: [{
    name: 'auth.spec.ts',
    assertionResults: [
      { status: 'passed', title: 'authenticates' },
      { status: 'failed', title: 'refresh fails', failureMessages: ['Token expired'] },
      { status: 'failed', title: 'validate fails', failureMessages: ['Invalid signature'] },
    ],
  }],
})

describe('runTestFile', () => {
  beforeEach(() => {
    mockExecSync.mockReset()
  })

  it('returns structured result for passing tests', () => {
    // First call: vitest --version check
    mockExecSync.mockReturnValueOnce('vitest 3.2.4')
    // Second call: actual test run
    mockExecSync.mockReturnValueOnce(PASSING_JSON)

    const result = runTestFile('auth.spec.ts', '/project')
    expect(result.passed).toBe(3)
    expect(result.failed).toBe(0)
    expect(result.total).toBe(3)
    expect(result.exitCode).toBe(0)
    expect(result.summary).toBe('3 passed')
    expect(result.path).toBe('auth.spec.ts')
  })

  it('returns structured result for failing tests', () => {
    mockExecSync.mockReturnValueOnce('vitest 3.2.4')
    // Failing test throws (non-zero exit)
    const error = Object.assign(new Error('test failed'), {
      status: 1,
      stdout: FAILING_JSON,
      stderr: '',
    })
    mockExecSync.mockImplementationOnce(() => { throw error })

    const result = runTestFile('auth.spec.ts', '/project')
    expect(result.passed).toBe(1)
    expect(result.failed).toBe(2)
    expect(result.exitCode).toBe(1)
    expect(result.firstFailure).toBe('Token expired')
    expect(result.summary).toContain('1 passed, 2 failed')
  })

  it('falls back to jest when vitest not available', () => {
    // vitest --version fails
    mockExecSync.mockImplementationOnce(() => { throw new Error('not found') })
    // jest --version succeeds
    mockExecSync.mockReturnValueOnce('jest 29.0.0')
    // actual test run
    mockExecSync.mockReturnValueOnce(PASSING_JSON)

    const result = runTestFile('auth.spec.ts', '/project')
    expect(result.passed).toBe(3)

    // Verify jest command was used (3rd call)
    const calls = mockExecSync.mock.calls
    expect(calls[2][0]).toContain('jest')
  })

  it('falls back to vitest when both version checks fail', () => {
    // Both version checks fail
    mockExecSync.mockImplementationOnce(() => { throw new Error('not found') })
    mockExecSync.mockImplementationOnce(() => { throw new Error('not found') })
    // Test run
    mockExecSync.mockReturnValueOnce(PASSING_JSON)

    const result = runTestFile('auth.spec.ts', '/project')
    expect(result.passed).toBe(3)

    // Falls back to vitest
    const calls = mockExecSync.mock.calls
    expect(calls[2][0]).toContain('vitest')
  })

  it('falls back to line parsing when JSON parse fails', () => {
    mockExecSync.mockReturnValueOnce('vitest 3.2.4')
    // Non-JSON output
    mockExecSync.mockReturnValueOnce(
      ' ✓ auth.spec.ts (3 tests)\n\n Tests  3 passed (3)\n'
    )

    const result = runTestFile('auth.spec.ts', '/project')
    expect(result.passed).toBe(3)
    expect(result.failed).toBe(0)
    expect(result.summary).toBe('3 passed')
  })

  it('handles line output with failures', () => {
    mockExecSync.mockReturnValueOnce('vitest 3.2.4')
    const error = Object.assign(new Error('test failed'), {
      status: 1,
      stdout: ' ✗ auth.spec.ts\n  FAIL auth should work\n\n Tests  2 passed | 1 failed (3)\n',
      stderr: '',
    })
    mockExecSync.mockImplementationOnce(() => { throw error })

    const result = runTestFile('auth.spec.ts', '/project')
    expect(result.passed).toBe(2)
    expect(result.failed).toBe(1)
    expect(result.exitCode).toBe(1)
  })

  it('handles complete failure (no output)', () => {
    mockExecSync.mockReturnValueOnce('vitest 3.2.4')
    const error = Object.assign(new Error('crash'), {
      status: 1,
      stdout: '',
      stderr: 'Segfault',
    })
    mockExecSync.mockImplementationOnce(() => { throw error })

    const result = runTestFile('auth.spec.ts', '/project')
    expect(result.exitCode).toBe(1)
    expect(result.summary).toBe('no tests found')
  })
})

describe('runTests', () => {
  beforeEach(() => {
    mockExecSync.mockReset()
  })

  it('aggregates results from multiple test files', () => {
    // For each file: version check + test run
    // File 1
    mockExecSync.mockReturnValueOnce('vitest 3.2.4')
    mockExecSync.mockReturnValueOnce(PASSING_JSON)
    // File 2
    mockExecSync.mockReturnValueOnce('vitest 3.2.4')
    mockExecSync.mockReturnValueOnce(PASSING_JSON)

    const summary = runTests(['auth.spec.ts', 'token.spec.ts'], '/project')
    expect(summary.results).toHaveLength(2)
    expect(summary.totalPassed).toBe(6)
    expect(summary.totalFailed).toBe(0)
    expect(summary.allPassed).toBe(true)
    expect(summary.summary).toContain('6 tests passed across 2 files')
  })

  it('reports allPassed=false when any file has failures', () => {
    // File 1 passes
    mockExecSync.mockReturnValueOnce('vitest 3.2.4')
    mockExecSync.mockReturnValueOnce(PASSING_JSON)
    // File 2 fails
    mockExecSync.mockReturnValueOnce('vitest 3.2.4')
    const error = Object.assign(new Error('fail'), {
      status: 1, stdout: FAILING_JSON, stderr: '',
    })
    mockExecSync.mockImplementationOnce(() => { throw error })

    const summary = runTests(['pass.spec.ts', 'fail.spec.ts'], '/project')
    expect(summary.allPassed).toBe(false)
    expect(summary.totalPassed).toBe(4) // 3 + 1
    expect(summary.totalFailed).toBe(2)
    expect(summary.summary).toContain('4 passed, 2 failed across 2 files')
  })

  it('returns empty results for no test paths', () => {
    const summary = runTests([], '/project')
    expect(summary.results).toHaveLength(0)
    expect(summary.totalPassed).toBe(0)
    expect(summary.totalFailed).toBe(0)
    expect(summary.allPassed).toBe(false) // 0 passed means not "all passed"
  })

  it('handles single file', () => {
    mockExecSync.mockReturnValueOnce('vitest 3.2.4')
    mockExecSync.mockReturnValueOnce(PASSING_JSON)

    const summary = runTests(['single.spec.ts'], '/project')
    expect(summary.results).toHaveLength(1)
    expect(summary.allPassed).toBe(true)
    expect(summary.summary).toContain('across 1 files')
  })
})
