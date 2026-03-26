// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, it, expect, vi } from 'vitest'
import {
  PACKET_COLORS,
  DELTA_TYPE_COLORS,
  getDeltaColor,
  shortPath,
  isUrl,
} from './primitives'

// Mock @xyflow/react for Handle components
vi.mock('@xyflow/react', () => ({
  Handle: ({ position, id }: { position: string; id: string }) =>
    <div data-testid={`handle-${id}`} data-position={position} />,
  Position: { Left: 'left', Right: 'right', Top: 'top', Bottom: 'bottom' },
}))

describe('PACKET_COLORS', () => {
  it('provides the standard color palette', () => {
    expect(PACKET_COLORS.green).toBe('#22c55e')
    expect(PACKET_COLORS.blue).toBe('#3b82f6')
    expect(PACKET_COLORS.amber).toBe('#f59e0b')
    expect(PACKET_COLORS.red).toBe('#ef4444')
    expect(PACKET_COLORS.purple).toBe('#8b5cf6')
    expect(PACKET_COLORS.gray).toBe('#6b7280')
  })
})

describe('getDeltaColor', () => {
  it('returns correct color for known delta types', () => {
    expect(getDeltaColor('discovery')).toBe(PACKET_COLORS.blue)
    expect(getDeltaColor('success')).toBe(PACKET_COLORS.green)
    expect(getDeltaColor('promotion')).toBe(PACKET_COLORS.green)
    expect(getDeltaColor('failure')).toBe(PACKET_COLORS.red)
    expect(getDeltaColor('mutation')).toBe(PACKET_COLORS.orange)
    expect(getDeltaColor('reasoning')).toBe(PACKET_COLORS.purple)
    expect(getDeltaColor('observation')).toBe(PACKET_COLORS.teal)
    expect(getDeltaColor('decision')).toBe(PACKET_COLORS.pink)
  })

  it('returns gray for unknown delta types', () => {
    expect(getDeltaColor('unknown')).toBe(PACKET_COLORS.gray)
    expect(getDeltaColor('')).toBe(PACKET_COLORS.gray)
  })

  it('DELTA_TYPE_COLORS has entries for all standard types', () => {
    const expected = ['discovery', 'reasoning', 'mutation', 'promotion', 'success', 'failure', 'collapse', 'log', 'observation', 'decision']
    for (const type of expected) {
      expect(DELTA_TYPE_COLORS[type]).toBeDefined()
    }
  })
})

describe('shortPath', () => {
  it('shortens deep file paths to last 2 segments', () => {
    expect(shortPath('/very/deep/nested/path/to/file.md')).toBe('.../to/file.md')
  })

  it('returns short paths unchanged', () => {
    expect(shortPath('src/file.ts')).toBe('src/file.ts')
  })

  it('returns single-segment paths unchanged', () => {
    expect(shortPath('README.md')).toBe('README.md')
  })

  it('shortens URLs to hostname + pathname', () => {
    expect(shortPath('https://docs.example.com/api/auth')).toBe('docs.example.com/api/auth')
  })

  it('handles http URLs (hostname excludes port)', () => {
    // URL.hostname strips the port — this is intentional for display brevity
    expect(shortPath('http://localhost:3000/health')).toBe('localhost/health')
  })

  it('falls back to raw string for malformed URLs', () => {
    expect(shortPath('https://')).toBe('https://')
  })
})

describe('isUrl', () => {
  it('detects https URLs', () => {
    expect(isUrl('https://example.com')).toBe(true)
  })

  it('detects http URLs', () => {
    expect(isUrl('http://localhost:3000')).toBe(true)
  })

  it('rejects file paths', () => {
    expect(isUrl('/docs/auth.md')).toBe(false)
    expect(isUrl('src/service.ts')).toBe(false)
  })
})

describe('PillHandles', () => {
  it('renders 4 handles with correct IDs', async () => {
    const { PillHandles } = await import('./primitives')
    const markup = renderToStaticMarkup(<PillHandles color="#3b82f6" />)
    expect(markup).toContain('handle-left')
    expect(markup).toContain('handle-right')
    expect(markup).toContain('handle-top')
    expect(markup).toContain('handle-bottom')
  })
})

describe('CardHandles', () => {
  it('renders 8 handles (4 target + 4 source)', async () => {
    const { CardHandles } = await import('./primitives')
    const markup = renderToStaticMarkup(<CardHandles color="#22c55e" />)
    expect(markup).toContain('handle-top')
    expect(markup).toContain('handle-left')
    expect(markup).toContain('handle-right')
    expect(markup).toContain('handle-bottom')
    expect(markup).toContain('handle-source-top')
    expect(markup).toContain('handle-source-left')
    expect(markup).toContain('handle-source-right')
    expect(markup).toContain('handle-source-bottom')
  })
})

describe('ProgressRing', () => {
  it('renders percentage mode by default', async () => {
    const { ProgressRing } = await import('./primitives')
    const markup = renderToStaticMarkup(<ProgressRing value={75} color="#3b82f6" />)
    expect(markup).toContain('75%')
    expect(markup).toContain('svg')
  })

  it('renders count mode', async () => {
    const { ProgressRing } = await import('./primitives')
    const markup = renderToStaticMarkup(<ProgressRing value={3} color="#22c55e" mode="count" />)
    expect(markup).toContain('>3<')
    expect(markup).not.toContain('%')
  })

  it('respects size parameter', async () => {
    const { ProgressRing } = await import('./primitives')
    const markup = renderToStaticMarkup(<ProgressRing value={50} color="#f59e0b" size={32} />)
    expect(markup).toContain('width="32"')
    expect(markup).toContain('height="32"')
  })
})

describe('SectionLabel', () => {
  it('renders uppercase label with divider line', async () => {
    const { SectionLabel } = await import('./primitives')
    const markup = renderToStaticMarkup(<SectionLabel label="Current State" color="#3b82f6" />)
    expect(markup).toContain('Current State')
    expect(markup).toContain('text-transform:uppercase')
  })
})

describe('StatusDot', () => {
  it('renders a colored dot with glow', async () => {
    const { StatusDot } = await import('./primitives')
    const markup = renderToStaticMarkup(<StatusDot color="#22c55e" />)
    expect(markup).toContain('#22c55e')
    expect(markup).toContain('border-radius:50%')
  })

  it('respects size parameter', async () => {
    const { StatusDot } = await import('./primitives')
    const markup = renderToStaticMarkup(<StatusDot color="#ef4444" size={12} />)
    expect(markup).toContain('width:12px')
    expect(markup).toContain('height:12px')
  })
})
