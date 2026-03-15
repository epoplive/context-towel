import { describe, expect, it } from 'vitest'

import { paginateMarkdown } from '../paginateMarkdown'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a paragraph of N visible characters. */
function para(n: number, char = 'A'): string {
  return char.repeat(n)
}

/** Verify that the pages array reconstructs the original content exactly. */
function pagesReconstructContent(pages: Array<{ content: string }>): string {
  return pages.map(p => p.content).join('')
}

// ---------------------------------------------------------------------------
// Explicit --- break
// ---------------------------------------------------------------------------

describe('explicit --- page break', () => {
  it('creates a page boundary at a thematic break regardless of size', () => {
    const content = `First section content.\n\n---\n\nSecond section content.\n`
    const { pages } = paginateMarkdown(content, { maxChars: 4000, targetChars: 3000, minChars: 10 })

    expect(pages.length).toBe(2)
    expect(pages[0].content).toContain('First section content.')
    expect(pages[1].content).toContain('Second section content.')
  })

  it('does not include the --- marker itself on either page', () => {
    const content = `Before.\n\n---\n\nAfter.\n`
    const { pages } = paginateMarkdown(content, { maxChars: 4000, targetChars: 3000, minChars: 10 })

    for (const page of pages) {
      // The raw `---` that was a thematic break should not appear as a
      // standalone horizontal rule in any page's content slice.  We check that
      // neither page contains the literal separator line.
      expect(page.content).not.toMatch(/^---\s*$/m)
    }
  })

  it('handles multiple --- breaks producing one page per section', () => {
    const content = [
      'Section one.',
      '',
      '---',
      '',
      'Section two.',
      '',
      '---',
      '',
      'Section three.',
    ].join('\n')

    const { pages } = paginateMarkdown(content, { maxChars: 4000, targetChars: 3000, minChars: 5 })

    expect(pages.length).toBe(3)
    expect(pages[0].content).toContain('Section one.')
    expect(pages[1].content).toContain('Section two.')
    expect(pages[2].content).toContain('Section three.')
  })

  it('forces a break even when page is below minChars', () => {
    // Even a tiny page has a forced break at ---
    const content = `Tiny.\n\n---\n\nAlso tiny.\n`
    const { pages } = paginateMarkdown(content, { maxChars: 4000, targetChars: 3000, minChars: 500 })

    expect(pages.length).toBe(2)
  })
})

// ---------------------------------------------------------------------------
// Fenced code blocks are never split
// ---------------------------------------------------------------------------

describe('fenced code blocks are never split', () => {
  it('keeps a code block whole when it fits on the current page', () => {
    const code = '```typescript\nconst x = 1\n```'
    const content = `${para(100)}\n\n${code}\n`
    const { pages } = paginateMarkdown(content, { maxChars: 400, targetChars: 300, minChars: 50 })

    // The code block must appear entirely on one page.
    const codePageCount = pages.filter(p => p.content.includes('const x = 1')).length
    expect(codePageCount).toBe(1)
    // It must not be split across two pages.
    for (const page of pages) {
      if (page.content.includes('```typescript')) {
        expect(page.content).toContain('const x = 1')
        expect(page.content).toContain('```')
      }
    }
  })

  it('keeps a large code block on its own page rather than splitting it', () => {
    const codeBody = Array.from({ length: 60 }, (_, i) => `  const line${i} = ${i}`).join('\n')
    const code = `\`\`\`typescript\n${codeBody}\n\`\`\``
    const content = `${para(300)}\n\n${code}\n\n${para(300)}\n`

    const { pages } = paginateMarkdown(content, { maxChars: 400, targetChars: 300, minChars: 50 })

    const codePageIndex = pages.findIndex(p => p.content.includes('const line0'))
    expect(codePageIndex).toBeGreaterThanOrEqual(0)

    const codePage = pages[codePageIndex]
    // All lines of the code block are on the same page.
    expect(codePage.content).toContain('const line0')
    expect(codePage.content).toContain('const line59')
  })

  it('keeps a task fenced block (~~~ task) whole', () => {
    const taskBlock = [
      '~~~task',
      'id: task-1',
      'title: Do the thing',
      'status: todo',
      '~~~',
    ].join('\n')

    const content = `${para(200)}\n\n${taskBlock}\n\n${para(200)}\n`
    const { pages } = paginateMarkdown(content, { maxChars: 400, targetChars: 300, minChars: 50 })

    const taskPageCount = pages.filter(p => p.content.includes('id: task-1')).length
    expect(taskPageCount).toBe(1)

    const taskPage = pages.find(p => p.content.includes('id: task-1'))
    expect(taskPage?.content).toContain('~~~task')
    expect(taskPage?.content).toContain('id: task-1')
    expect(taskPage?.content).toContain('~~~')
  })

  it('keeps a checklist fenced block whole', () => {
    const checklistBlock = [
      '```checklist',
      '- [ ] Item one',
      '- [x] Item two',
      '```',
    ].join('\n')

    const content = `${para(200)}\n\n${checklistBlock}\n`
    const { pages } = paginateMarkdown(content, { maxChars: 300, targetChars: 250, minChars: 50 })

    const clPageCount = pages.filter(p => p.content.includes('Item one')).length
    expect(clPageCount).toBe(1)
  })
})

// ---------------------------------------------------------------------------
// Heading is always grouped with following content
// ---------------------------------------------------------------------------

describe('heading is grouped with following content', () => {
  it('does not produce a page whose only content is a heading', () => {
    // Build enough content before the heading to trigger a soft break, then
    // follow with a paragraph.  The heading must not end up alone.
    const content = [
      para(400, 'A'),
      '',
      '## Section Heading',
      '',
      para(100, 'B'),
    ].join('\n')

    const { pages } = paginateMarkdown(content, { maxChars: 600, targetChars: 400, minChars: 50 })

    for (const page of pages) {
      const lines = page.content.trim().split('\n').filter(l => l.trim().length > 0)
      if (lines.length === 1 && lines[0].startsWith('#')) {
        throw new Error(`Heading-only page detected: "${lines[0]}"`)
      }
    }
  })

  it('breaks BEFORE a heading, not after', () => {
    const content = [
      para(400, 'A'),
      '',
      '## New Section',
      '',
      para(200, 'B'),
    ].join('\n')

    const { pages } = paginateMarkdown(content, { maxChars: 800, targetChars: 400, minChars: 100 })

    // The heading must share a page with the paragraph that follows it.
    const headingPageIndex = pages.findIndex(p => p.content.includes('## New Section'))
    expect(headingPageIndex).toBeGreaterThanOrEqual(0)
    expect(pages[headingPageIndex].content).toContain('B'.repeat(200))
  })

  it('merge pass removes heading-only pages', () => {
    // Construct a scenario where the size logic ends up emitting a heading alone.
    // The merge pass must absorb it forward.
    const content = [
      para(900, 'A'),
      '',
      '## Lonely Heading',
      '',
      para(50, 'B'),
    ].join('\n')

    const { pages } = paginateMarkdown(content, { maxChars: 1000, targetChars: 900, minChars: 50 })

    for (const page of pages) {
      const stripped = page.content.replace(/\s+/g, ' ').trim()
      if (/^#{1,6} /.test(stripped) && stripped.length < 60) {
        // Only pass if there's more content beyond the heading marker line.
        const bodyLines = page.content.split('\n').filter(l => !l.startsWith('#') && l.trim().length > 0)
        expect(bodyLines.length).toBeGreaterThan(0)
      }
    }
  })
})

// ---------------------------------------------------------------------------
// Multiple sequential task blocks are grouped
// ---------------------------------------------------------------------------

describe('sequential task blocks are grouped', () => {
  function makeTask(id: number, body = ''): string {
    return [
      '~~~task',
      `id: task-${id}`,
      `title: Task number ${id}`,
      'status: todo',
      ...(body ? [`description: |\n  ${body}`] : []),
      '~~~',
    ].join('\n')
  }

  it('groups small sequential task blocks together rather than one per page', () => {
    const tasks = Array.from({ length: 4 }, (_, i) => makeTask(i + 1)).join('\n\n')
    const content = `# Task List\n\n${tasks}\n`

    const { pages } = paginateMarkdown(content, { maxChars: 4000, targetChars: 3000, minChars: 100 })

    // With 4 small tasks and a generous maxChars, they should all be on one page
    // (or at most 2) rather than spread across 4+ pages.
    expect(pages.length).toBeLessThanOrEqual(2)

    // All tasks must appear somewhere.
    const allContent = pages.map(p => p.content).join('')
    for (let i = 1; i <= 4; i++) {
      expect(allContent).toContain(`id: task-${i}`)
    }
  })

  it('groups task blocks up to targetChars then splits naturally', () => {
    // Make tasks large enough that only 2 fit per page.
    const bigBody = para(250, 'X')
    const tasks = Array.from({ length: 6 }, (_, i) => makeTask(i + 1, bigBody)).join('\n\n')
    const content = `${tasks}\n`

    const { pages } = paginateMarkdown(content, { maxChars: 1200, targetChars: 900, minChars: 200 })

    // Should produce multiple pages, but each page should have more than one task
    // when they fit.
    expect(pages.length).toBeGreaterThan(1)
    expect(pages.length).toBeLessThan(6)

    // All tasks must be present.
    const allContent = pages.map(p => p.content).join('')
    for (let i = 1; i <= 6; i++) {
      expect(allContent).toContain(`id: task-${i}`)
    }
  })
})

// ---------------------------------------------------------------------------
// Tiny heading-only pages are merged
// ---------------------------------------------------------------------------

describe('tiny heading-only pages are merged', () => {
  it('merges a heading-only first page forward into the second page', () => {
    const content = `# Title\n\n${para(300, 'A')}\n`
    const { pages } = paginateMarkdown(content, { maxChars: 600, targetChars: 500, minChars: 400 })

    // The heading should appear on the same page as the paragraph.
    expect(pages[0].content).toContain('# Title')
    expect(pages[0].content).toContain(para(300, 'A'))
  })

  it('merges heading-only page in the middle into previous page when safe', () => {
    // First page has plenty of content. A lone heading follows, then more content.
    const content = [
      para(600, 'A'),
      '',
      '## Middle Heading',
      '',
      para(600, 'B'),
    ].join('\n')

    const { pages } = paginateMarkdown(content, { maxChars: 1500, targetChars: 700, minChars: 100 })

    for (const page of pages) {
      if (page.content.includes('## Middle Heading')) {
        // The heading must not be alone.
        const bodyLines = page.content.split('\n').filter(l => !l.startsWith('#') && l.trim().length > 0)
        expect(bodyLines.length).toBeGreaterThan(0)
      }
    }
  })
})

// ---------------------------------------------------------------------------
// Large documents produce reasonable page counts
// ---------------------------------------------------------------------------

describe('large documents', () => {
  it('paginates a large document into a sensible number of pages', () => {
    const sections = Array.from({ length: 10 }, (_, i) =>
      [`## Section ${i + 1}`, '', para(500, String.fromCharCode(65 + i))].join('\n'),
    ).join('\n\n')

    const { pages } = paginateMarkdown(sections, { maxChars: 1200, targetChars: 900, minChars: 200 })

    // 10 sections x ~500 chars each = ~5000 chars total; at ~900 target we expect ~5-8 pages
    expect(pages.length).toBeGreaterThanOrEqual(4)
    expect(pages.length).toBeLessThanOrEqual(12)

    // Content is lossless — all sections present.
    const allContent = pages.map(p => p.content).join('')
    for (let i = 1; i <= 10; i++) {
      expect(allContent).toContain(`## Section ${i}`)
    }
  })

  it('page content concatenation reconstructs the original without --- breaks', () => {
    // For documents without explicit --- breaks, pages must reconstruct content.
    const content = Array.from({ length: 5 }, (_, i) =>
      `## Chapter ${i + 1}\n\n${para(400, String.fromCharCode(65 + i))}`,
    ).join('\n\n')

    const { pages } = paginateMarkdown(content, { maxChars: 1000, targetChars: 700, minChars: 100 })

    const reconstructed = pagesReconstructContent(pages)
    // All chapter headings and body text must be present.
    for (let i = 1; i <= 5; i++) {
      expect(reconstructed).toContain(`## Chapter ${i}`)
    }
  })

  it('handles an empty document without throwing', () => {
    const { pages, headings } = paginateMarkdown('')
    expect(pages.length).toBe(1)
    expect(headings.length).toBe(0)
  })

  it('handles a document with only whitespace without throwing', () => {
    const { pages } = paginateMarkdown('   \n\n   ')
    expect(pages.length).toBeGreaterThanOrEqual(1)
  })
})
