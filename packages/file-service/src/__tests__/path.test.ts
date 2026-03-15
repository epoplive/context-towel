import { describe, it, expect } from 'vitest'
import { normalizePath, HomeDirResolver, ensureDirectoryForFile } from '../path'

describe('normalizePath', () => {
  it('converts backslashes to forward slashes', () => {
    expect(normalizePath('C:\\Users\\foo\\bar')).toBe('C:/Users/foo/bar')
  })

  it('strips trailing slashes', () => {
    expect(normalizePath('/foo/bar/')).toBe('/foo/bar')
    expect(normalizePath('/foo/bar///')).toBe('/foo/bar')
  })

  it('handles mixed separators', () => {
    expect(normalizePath('C:\\Users/foo\\bar/')).toBe('C:/Users/foo/bar')
  })

  it('handles empty string', () => {
    expect(normalizePath('')).toBe('')
  })

  it('handles root path', () => {
    expect(normalizePath('/')).toBe('')
  })
})

describe('HomeDirResolver', () => {
  describe('resolveSync', () => {
    it('returns process.env.HOME when available', () => {
      const original = process.env.HOME
      process.env.HOME = '/test/home'
      const resolver = new HomeDirResolver()
      expect(resolver.resolveSync()).toBe('/test/home')
      process.env.HOME = original
    })

    it('caches the result', () => {
      const original = process.env.HOME
      process.env.HOME = '/test/home'
      const resolver = new HomeDirResolver()
      resolver.resolveSync()
      process.env.HOME = '/different'
      expect(resolver.resolveSync()).toBe('/test/home') // cached
      process.env.HOME = original
    })
  })

  describe('resolvePath', () => {
    it('returns normalized path for absolute paths', async () => {
      const resolver = new HomeDirResolver()
      expect(await resolver.resolvePath('/foo/bar')).toBe('/foo/bar')
    })

    it('expands tilde to home directory', async () => {
      const original = process.env.HOME
      process.env.HOME = '/home/user'
      const resolver = new HomeDirResolver()
      expect(await resolver.resolvePath('~/documents/file.md')).toBe('/home/user/documents/file.md')
      process.env.HOME = original
    })

    it('handles tilde alone', async () => {
      const original = process.env.HOME
      process.env.HOME = '/home/user'
      const resolver = new HomeDirResolver()
      expect(await resolver.resolvePath('~')).toBe('/home/user')
      process.env.HOME = original
    })

    it('does not expand tilde in the middle of a path', async () => {
      const resolver = new HomeDirResolver()
      expect(await resolver.resolvePath('/foo/~bar')).toBe('/foo/~bar')
    })

    it('normalizes backslashes', async () => {
      const resolver = new HomeDirResolver()
      expect(await resolver.resolvePath('C:\\Users\\foo')).toBe('C:/Users/foo')
    })
  })

  describe('resolvePathSync', () => {
    it('expands tilde synchronously', () => {
      const original = process.env.HOME
      process.env.HOME = '/home/user'
      const resolver = new HomeDirResolver()
      resolver.resolveSync() // prime the cache
      expect(resolver.resolvePathSync('~/foo')).toBe('/home/user/foo')
      process.env.HOME = original
    })

    it('returns path as-is when no home dir available', () => {
      const original = process.env.HOME
      delete process.env.HOME
      const resolver = new HomeDirResolver()
      expect(resolver.resolvePathSync('~/foo')).toBe('~/foo')
      process.env.HOME = original
    })
  })
})

describe('ensureDirectoryForFile', () => {
  it('calls mkdirFn with parent directory', async () => {
    const mkdirFn = async (_dir: string) => {}
    const calls: string[] = []
    const trackedMkdir = async (dir: string) => { calls.push(dir) }

    await ensureDirectoryForFile('/foo/bar/baz.md', trackedMkdir)
    expect(calls).toEqual(['/foo/bar'])
  })

  it('does nothing for root-level files', async () => {
    const calls: string[] = []
    const trackedMkdir = async (dir: string) => { calls.push(dir) }

    await ensureDirectoryForFile('/file.md', trackedMkdir)
    expect(calls).toEqual([])
  })

  it('normalizes backslashes before extracting parent', async () => {
    const calls: string[] = []
    const trackedMkdir = async (dir: string) => { calls.push(dir) }

    await ensureDirectoryForFile('C:\\Users\\foo\\bar.md', trackedMkdir)
    expect(calls).toEqual(['C:/Users/foo'])
  })
})
