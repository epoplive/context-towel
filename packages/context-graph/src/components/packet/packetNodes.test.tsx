// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, it, expect, vi } from 'vitest'
import type { ReferenceNodeData } from './ReferenceNode'
import type { TestNodeData } from './TestNode'
import type { GapNodeData } from './GapNode'

// Mock @xyflow/react — Handle tries to access ReactFlow context which doesn't exist in tests
vi.mock('@xyflow/react', () => ({
  Handle: ({ position, id }: { position: string; id: string }) =>
    <div data-testid={`handle-${id}`} data-position={position} />,
  Position: { Left: 'left', Right: 'right', Top: 'top', Bottom: 'bottom' },
}))

// Mock mermaid — can't run in jsdom
vi.mock('mermaid', () => ({
  default: {
    render: vi.fn(),
    initialize: vi.fn(),
  },
}))

describe('ReferenceNode', () => {
  it('renders file path with REF label', async () => {
    const { ReferenceNode } = await import('./ReferenceNode')
    const data: ReferenceNodeData = { path: '/docs/auth/middleware.md' }
    const markup = renderToStaticMarkup(<ReferenceNode data={data} />)

    expect(markup).toContain('REF')
    expect(markup).toContain('middleware.md') // last segment visible
    expect(markup).toContain('/docs/auth/middleware.md') // full path in title
  })

  it('renders URL with URL label', async () => {
    const { ReferenceNode } = await import('./ReferenceNode')
    const data: ReferenceNodeData = { path: 'https://docs.example.com/api/auth' }
    const markup = renderToStaticMarkup(<ReferenceNode data={data} />)

    expect(markup).toContain('URL')
    expect(markup).toContain('docs.example.com')
  })

  it('shortens deep file paths with ellipsis', async () => {
    const { ReferenceNode } = await import('./ReferenceNode')
    const data: ReferenceNodeData = { path: '/very/deep/nested/path/to/file.md' }
    const markup = renderToStaticMarkup(<ReferenceNode data={data} />)

    expect(markup).toContain('.../to/file.md')
  })

  it('renders 4 handles for edge connections', async () => {
    const { ReferenceNode } = await import('./ReferenceNode')
    const data: ReferenceNodeData = { path: '/foo.md' }
    const markup = renderToStaticMarkup(<ReferenceNode data={data} />)

    expect(markup).toContain('handle-left')
    expect(markup).toContain('handle-right')
    expect(markup).toContain('handle-top')
    expect(markup).toContain('handle-bottom')
  })
})

describe('TestNode', () => {
  it('renders test path with pending status by default', async () => {
    const { TestNode } = await import('./TestNode')
    const data: TestNodeData = { path: 'tests/auth.spec.ts' }
    const markup = renderToStaticMarkup(<TestNode data={data} />)

    expect(markup).toContain('TEST')
    expect(markup).toContain('auth.spec.ts')
  })

  it('renders PASS when testStatus is pass', async () => {
    const { TestNode } = await import('./TestNode')
    const data: TestNodeData = { path: 'tests/auth.spec.ts', testStatus: 'pass' }
    const markup = renderToStaticMarkup(<TestNode data={data} />)

    expect(markup).toContain('PASS')
    // Green accent color
    expect(markup).toContain('#22c55e')
  })

  it('renders FAIL when testStatus is fail', async () => {
    const { TestNode } = await import('./TestNode')
    const data: TestNodeData = { path: 'tests/auth.spec.ts', testStatus: 'fail' }
    const markup = renderToStaticMarkup(<TestNode data={data} />)

    expect(markup).toContain('FAIL')
    // Red accent color
    expect(markup).toContain('#ef4444')
  })

  it('derives pass from body content keywords', async () => {
    const { TestNode } = await import('./TestNode')
    const data: TestNodeData = { path: 'tests/auth.spec.ts', body: 'All tests passed ✓' }
    const markup = renderToStaticMarkup(<TestNode data={data} />)

    expect(markup).toContain('PASS')
  })

  it('derives fail from body content keywords', async () => {
    const { TestNode } = await import('./TestNode')
    const data: TestNodeData = { path: 'tests/auth.spec.ts', body: '2 tests failed with errors' }
    const markup = renderToStaticMarkup(<TestNode data={data} />)

    expect(markup).toContain('FAIL')
  })

  it('derives pass from resolved state', async () => {
    const { TestNode } = await import('./TestNode')
    const data: TestNodeData = { path: 'tests/auth.spec.ts', state: 'resolved' }
    const markup = renderToStaticMarkup(<TestNode data={data} />)

    expect(markup).toContain('PASS')
  })
})

describe('GapNode (badge bar)', () => {
  it('renders without badge bar when no attachedCounts', async () => {
    const { GapNode } = await import('./GapNode')
    const data: GapNodeData = { text: 'Investigate auth', state: 'open' }
    const markup = renderToStaticMarkup(<GapNode data={data} />)

    expect(markup).toContain('Investigate auth')
    expect(markup).not.toContain('refs')
    expect(markup).not.toContain('tests')
    expect(markup).not.toContain('diags')
  })

  it('renders badge bar with attachment counts', async () => {
    const { GapNode } = await import('./GapNode')
    const data: GapNodeData = {
      text: 'Auth flow work',
      state: 'in-progress',
      attachedCounts: { references: 3, tests: 2, diagrams: 1 },
    }
    const markup = renderToStaticMarkup(<GapNode data={data} />)

    expect(markup).toContain('3 refs')
    expect(markup).toContain('2 tests')
    expect(markup).toContain('1 diag')
  })

  it('skips zero-count badges', async () => {
    const { GapNode } = await import('./GapNode')
    const data: GapNodeData = {
      text: 'Test only',
      state: 'open',
      attachedCounts: { references: 0, tests: 5, diagrams: 0 },
    }
    const markup = renderToStaticMarkup(<GapNode data={data} />)

    expect(markup).not.toContain('refs')
    expect(markup).toContain('5 tests')
    expect(markup).not.toContain('diag')
  })

  it('renders different visual states', async () => {
    const { GapNode } = await import('./GapNode')

    // Open state — amber accent
    const openMarkup = renderToStaticMarkup(
      <GapNode data={{ text: 'Open gap', state: 'open' }} />
    )
    expect(openMarkup).toContain('#f59e0b')

    // In-progress — blue accent
    const progressMarkup = renderToStaticMarkup(
      <GapNode data={{ text: 'Working', state: 'in-progress' }} />
    )
    expect(progressMarkup).toContain('#3b82f6')

    // Resolved — green accent
    const resolvedMarkup = renderToStaticMarkup(
      <GapNode data={{ text: 'Done', state: 'resolved' }} />
    )
    expect(resolvedMarkup).toContain('#22c55e')
  })
})
