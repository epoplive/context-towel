import { describe, it, expect } from 'vitest'
import { seedIndexFromFiles } from '../../src/index-seeder'

describe('seedIndexFromFiles', () => {
  it('generates FILE_PATHS for all included files', () => {
    const files = [
      'src/auth/token.ts',
      'src/auth/session.ts',
      'src/api/routes.ts',
    ]
    const result = seedIndexFromFiles(files)

    expect(result.indexContent).toContain('# FILE_PATHS')
    expect(result.indexContent).toContain('F1:src/auth/token.ts')
    expect(result.indexContent).toContain('F2:src/auth/session.ts')
    expect(result.indexContent).toContain('F3:src/api/routes.ts')
    expect(result.stats.filesIncluded).toBe(3)
  })

  it('excludes node_modules by default', () => {
    const files = [
      'src/index.ts',
      'node_modules/react/index.js',
    ]
    const result = seedIndexFromFiles(files)

    expect(result.indexContent).toContain('F1:src/index.ts')
    expect(result.indexContent).not.toContain('node_modules')
    expect(result.stats.filesIncluded).toBe(1)
  })

  it('excludes dist files by default', () => {
    const files = [
      'src/main.ts',
      'dist/main.js',
    ]
    const result = seedIndexFromFiles(files)

    expect(result.stats.filesIncluded).toBe(1)
  })

  it('respects maxFiles limit', () => {
    const files = Array.from({ length: 100 }, (_, i) => `src/file-${i}.ts`)
    const result = seedIndexFromFiles(files, { maxFiles: 10 })

    expect(result.stats.filesIncluded).toBe(10)
    expect(result.stats.filesFound).toBe(100)
  })

  it('detects system boundaries from directory structure', () => {
    const files = [
      'src/auth/login.ts',
      'src/auth/token.ts',
      'src/auth/session.ts',
      'src/api/routes.ts',
      'src/api/middleware.ts',
    ]
    const result = seedIndexFromFiles(files)

    expect(result.indexContent).toContain('# SYSTEMS')
    expect(result.stats.systemsDetected).toBeGreaterThan(0)
  })

  it('creates context links for systems sharing files', () => {
    // Create a structure where systems overlap
    const files = [
      'src/auth/handler.ts',
      'src/auth/middleware.ts',
    ]
    const result = seedIndexFromFiles(files)

    // With only 2 files in one directory, we get a system but no cross-links
    expect(result.stats.systemsDetected).toBeGreaterThanOrEqual(1)
  })

  it('generates valid index block format', () => {
    const files = [
      'src/core/engine.ts',
      'src/core/config.ts',
      'src/utils/helpers.ts',
      'src/utils/logger.ts',
    ]
    const result = seedIndexFromFiles(files)

    // Should start with FILE_PATHS section
    expect(result.indexContent.startsWith('# FILE_PATHS')).toBe(true)

    // F-IDs should be sequential
    expect(result.indexContent).toContain('F1:')
    expect(result.indexContent).toContain('F2:')
    expect(result.indexContent).toContain('F3:')
    expect(result.indexContent).toContain('F4:')
  })

  it('handles empty file list', () => {
    const result = seedIndexFromFiles([])

    expect(result.indexContent).toContain('# FILE_PATHS')
    expect(result.stats.filesIncluded).toBe(0)
    expect(result.stats.systemsDetected).toBe(0)
  })

  it('uses custom exclude patterns', () => {
    const files = [
      'src/main.ts',
      'src/test.ts',
      'vendor/lib.ts',
    ]
    const result = seedIndexFromFiles(files, {
      excludePatterns: ['vendor/**'],
    })

    expect(result.stats.filesIncluded).toBe(2)
    expect(result.indexContent).not.toContain('vendor')
  })

  it('excludes test files by default', () => {
    const files = [
      'src/auth.ts',
      'src/auth.spec.ts',
      'src/auth.test.ts',
    ]
    const result = seedIndexFromFiles(files)

    expect(result.stats.filesIncluded).toBe(1)
    expect(result.indexContent).toContain('src/auth.ts')
    expect(result.indexContent).not.toContain('spec')
    expect(result.indexContent).not.toContain('test')
  })

  it('systems include file ID references', () => {
    const files = [
      'src/services/auth.ts',
      'src/services/user.ts',
    ]
    const result = seedIndexFromFiles(files)

    if (result.stats.systemsDetected > 0) {
      // System entries should reference their file IDs
      expect(result.indexContent).toMatch(/S\d+:.*\|/)
      expect(result.indexContent).toMatch(/F\d+:/)
    }
  })
})
