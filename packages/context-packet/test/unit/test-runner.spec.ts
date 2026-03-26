import { describe, it, expect } from 'vitest'
import { parseVitestJson } from '../../src/testRunner.js'

// ── Sample vitest --reporter=json outputs ────────────────────────────────

const ALL_PASSING_JSON = JSON.stringify({
  numPassedTests: 5,
  numFailedTests: 0,
  numTotalTests: 5,
  testResults: [
    {
      name: '/path/to/test.spec.ts',
      assertionResults: [
        { status: 'passed', title: 'does thing' },
        { status: 'passed', title: 'does other thing' },
      ],
    },
  ],
})

const MIXED_RESULTS_JSON = JSON.stringify({
  numPassedTests: 3,
  numFailedTests: 2,
  numTotalTests: 5,
  testResults: [
    {
      name: '/path/to/test.spec.ts',
      assertionResults: [
        { status: 'passed', title: 'passes' },
        {
          status: 'failed',
          title: 'fails here',
          failureMessages: ['Expected true to be false\n  at line 42\n  at line 99'],
        },
        { status: 'failed', title: 'also fails', failureMessages: ['another error'] },
      ],
    },
  ],
})

const ALL_FAILING_JSON = JSON.stringify({
  numPassedTests: 0,
  numFailedTests: 3,
  numTotalTests: 3,
  testResults: [
    {
      name: '/path/to/test.spec.ts',
      assertionResults: [
        { status: 'failed', title: 'boom', failureMessages: ['TypeError: cannot read property'] },
      ],
    },
  ],
})

// ── Tests ──────────────────────────────────────────────────────────────────

describe('parseVitestJson', () => {
  it('parses all-passing JSON', () => {
    const result = parseVitestJson(ALL_PASSING_JSON, 'test.spec.ts')
    expect(result).not.toBeNull()
    expect(result!.passed).toBe(5)
    expect(result!.failed).toBe(0)
    expect(result!.total).toBe(5)
    expect(result!.firstFailure).toBeUndefined()
    expect(result!.summary).toBe('5 passed')
  })

  it('parses mixed pass/fail JSON', () => {
    const result = parseVitestJson(MIXED_RESULTS_JSON, 'test.spec.ts')
    expect(result).not.toBeNull()
    expect(result!.passed).toBe(3)
    expect(result!.failed).toBe(2)
    expect(result!.total).toBe(5)
    expect(result!.firstFailure).toBe('Expected true to be false')
    expect(result!.summary).toContain('3 passed, 2 failed')
  })

  it('parses all-failing JSON', () => {
    const result = parseVitestJson(ALL_FAILING_JSON, 'test.spec.ts')
    expect(result).not.toBeNull()
    expect(result!.passed).toBe(0)
    expect(result!.failed).toBe(3)
    expect(result!.firstFailure).toBe('TypeError: cannot read property')
  })

  it('handles JSON with prefix text (vitest output has preamble)', () => {
    const output = 'Running tests...\nSome log line\n' + ALL_PASSING_JSON
    const result = parseVitestJson(output, 'test.spec.ts')
    expect(result).not.toBeNull()
    expect(result!.passed).toBe(5)
  })

  it('returns null for non-JSON output', () => {
    expect(parseVitestJson('not json at all', 'test.spec.ts')).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(parseVitestJson('', 'test.spec.ts')).toBeNull()
  })

  it('returns null for output with no JSON object marker', () => {
    expect(parseVitestJson('Tests 5 passed', 'test.spec.ts')).toBeNull()
  })

  it('truncates long failure messages to 200 chars', () => {
    const longMessage = 'A'.repeat(300) + '\nsecond line'
    const json = JSON.stringify({
      numPassedTests: 0,
      numFailedTests: 1,
      numTotalTests: 1,
      testResults: [{
        name: 'x.spec.ts',
        assertionResults: [{ status: 'failed', title: 'x', failureMessages: [longMessage] }],
      }],
    })
    const result = parseVitestJson(json, 'x.spec.ts')
    expect(result!.firstFailure!.length).toBeLessThanOrEqual(200)
  })

  it('preserves path in result', () => {
    const result = parseVitestJson(ALL_PASSING_JSON, 'my/deep/path.spec.ts')
    expect(result!.path).toBe('my/deep/path.spec.ts')
  })

  it('handles missing testResults gracefully', () => {
    const json = JSON.stringify({ numPassedTests: 2, numFailedTests: 0, numTotalTests: 2 })
    const result = parseVitestJson(json, 'test.spec.ts')
    expect(result).not.toBeNull()
    expect(result!.passed).toBe(2)
    expect(result!.firstFailure).toBeUndefined()
  })

  it('defaults total to passed + failed when numTotalTests missing', () => {
    const json = JSON.stringify({ numPassedTests: 3, numFailedTests: 1 })
    const result = parseVitestJson(json, 'test.spec.ts')
    expect(result!.total).toBe(4)
  })

  it('uses title as fallback when failureMessages missing', () => {
    const json = JSON.stringify({
      numPassedTests: 0,
      numFailedTests: 1,
      numTotalTests: 1,
      testResults: [{
        name: 'x.spec.ts',
        assertionResults: [{ status: 'failed', title: 'my test description' }],
      }],
    })
    const result = parseVitestJson(json, 'test.spec.ts')
    expect(result!.firstFailure).toBe('my test description')
  })
})
