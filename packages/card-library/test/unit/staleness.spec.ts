import { describe, it, expect } from 'vitest'
import { parseIndexBlock } from '../../src/plugins/index/parser'
import { checkStaleness, generateSnapshots, formatStalenessReport } from '../../src/plugins/index/staleness'
import type { FileReader } from '../../src/plugins/index/resolver'

// Mock file system
function createMockReader(files: Record<string, string>): FileReader {
  return {
    async read(path: string): Promise<string> {
      if (path in files) return files[path]
      throw new Error(`File not found: ${path}`)
    },
  }
}

const SAMPLE_INDEX = `# FILE_PATHS
F1:src/auth/token.ts
F2:src/auth/session.ts

# SYSTEMS
S1:AUTH_SYSTEM|Auth|
F1>10-20:Token validation

# CODE_SNIPPETS
CS1:CHECK|Token check|
F1>10-20:@CODE@`

const MOCK_FILES: Record<string, string> = {
  'src/auth/token.ts': Array.from({ length: 50 }, (_, i) => `// line ${i + 1}`).join('\n'),
  'src/auth/session.ts': Array.from({ length: 30 }, (_, i) => `// session ${i + 1}`).join('\n'),
}

describe('checkStaleness', () => {
  it('reports all valid when files exist and ranges are good', async () => {
    const data = parseIndexBlock(SAMPLE_INDEX)
    const reader = createMockReader(MOCK_FILES)
    const report = await checkStaleness(data.registry, reader)

    expect(report.fileMissing).toHaveLength(0)
    expect(report.rangeInvalid).toHaveLength(0)
    expect(report.healthScore).toBe(1.0)
  })

  it('detects missing files', async () => {
    const data = parseIndexBlock(SAMPLE_INDEX)
    const reader = createMockReader({ 'src/auth/token.ts': '// only token' })
    const report = await checkStaleness(data.registry, reader)

    expect(report.fileMissing.length).toBeGreaterThan(0)
    const missing = report.fileMissing.find(c => c.detail.includes('session'))
    expect(missing).toBeDefined()
  })

  it('detects invalid line ranges', async () => {
    const indexWithBigRange = `# FILE_PATHS
F1:src/short.ts

# SYSTEMS
S1:SYS|System|
F1>90-100:Way past end`

    const data = parseIndexBlock(indexWithBigRange)
    const reader = createMockReader({
      'src/short.ts': 'line1\nline2\nline3',
    })
    const report = await checkStaleness(data.registry, reader)

    expect(report.rangeInvalid.length).toBeGreaterThan(0)
  })

  it('detects content changes when snapshots differ', async () => {
    const data = parseIndexBlock(SAMPLE_INDEX)
    const reader = createMockReader(MOCK_FILES)

    // Generate baseline snapshots
    const snapshots = await generateSnapshots(data.registry, reader)
    expect(snapshots.size).toBeGreaterThan(0)

    // Now change the file content
    const changedFiles = {
      ...MOCK_FILES,
      'src/auth/token.ts': Array.from({ length: 50 }, (_, i) => `// CHANGED line ${i + 1}`).join('\n'),
    }
    const changedReader = createMockReader(changedFiles)

    const report = await checkStaleness(data.registry, changedReader, snapshots)
    expect(report.contentChanged.length).toBeGreaterThan(0)
  })

  it('health score reflects staleness', async () => {
    const data = parseIndexBlock(SAMPLE_INDEX)
    const reader = createMockReader({}) // all files missing
    const report = await checkStaleness(data.registry, reader)

    expect(report.healthScore).toBeLessThan(1.0)
  })
})

describe('generateSnapshots', () => {
  it('creates snapshots for all line-range refs', async () => {
    const data = parseIndexBlock(SAMPLE_INDEX)
    const reader = createMockReader(MOCK_FILES)
    const snapshots = await generateSnapshots(data.registry, reader)

    expect(snapshots.size).toBeGreaterThan(0)
    for (const snap of snapshots.values()) {
      expect(snap.hash).toBeTruthy()
      expect(snap.firstLine).toBeTruthy()
    }
  })
})

describe('formatStalenessReport', () => {
  it('formats a clean report', () => {
    const text = formatStalenessReport({
      totalChecked: 5,
      valid: 5,
      fileMissing: [],
      rangeInvalid: [],
      contentChanged: [],
      healthScore: 1.0,
    })

    expect(text).toContain('100%')
    expect(text).toContain('All references are valid')
  })

  it('formats a report with issues', () => {
    const text = formatStalenessReport({
      totalChecked: 5,
      valid: 3,
      fileMissing: [{
        entityId: 'S1',
        ref: { fileId: 'F1' },
        status: 'file-missing',
        detail: 'File gone',
      }],
      rangeInvalid: [{
        entityId: 'S2',
        ref: { fileId: 'F2', startLine: 100, endLine: 200 },
        status: 'range-invalid',
        detail: 'Lines out of range',
      }],
      contentChanged: [],
      healthScore: 0.6,
    })

    expect(text).toContain('60%')
    expect(text).toContain('Missing Files')
    expect(text).toContain('Invalid Line Ranges')
  })
})
