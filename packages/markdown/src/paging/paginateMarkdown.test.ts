import { describe, expect, it } from 'vitest'

import { paginateMarkdown } from './paginateMarkdown'

describe('paginateMarkdown', () => {
  it('does not create blank pages for large reference-definition tails', () => {
    const para = 'A'.repeat(180)
    const defs = Array.from({ length: 80 }, (_, i) => `[ref-${i}]: https://example.com/${i}`).join('\n')
    const content = `# Title\n\n${para}\n\n${para}\n\n${defs}\n`

    const { pages } = paginateMarkdown(content, { maxChars: 200, targetChars: 150, minChars: 50 })

    // Definitions should not cause extra pages by themselves (they don't render).
    expect(pages.length).toBe(2)
    expect(pages[0]?.content).toContain('# Title')
    expect(pages[0]?.content).toContain(para)
    expect(pages[1]?.content).toContain(para)
    // The defs are still present in the raw markdown slice, but page 2 is not blank.
    expect(pages[1]?.content).toContain('[ref-0]:')
  })

  it('treats large HTML comment blocks as invisible for pagination', () => {
    const para = 'B'.repeat(180)
    const comment = `<!-- ${'x'.repeat(2500)} -->\n`
    const content = `# Title\n\n${para}\n\n${comment.repeat(3)}\n${para}\n`

    const { pages } = paginateMarkdown(content, { maxChars: 200, targetChars: 150, minChars: 50 })

    // Comments are ignored for visible sizing, so we still just get the two content pages.
    expect(pages.length).toBe(2)
    expect(pages[0]?.content).toContain(para)
    expect(pages[1]?.content).toContain(para)
  })

  it('treats large raw HTML blocks as invisible for pagination', () => {
    const para = 'C'.repeat(180)
    const html = `<INSTRUCTIONS>\n${'x'.repeat(2500)}\n</INSTRUCTIONS>\n`
    const content = `# Title\n\n${para}\n\n${html.repeat(3)}\n${para}\n`

    const { pages } = paginateMarkdown(content, { maxChars: 200, targetChars: 150, minChars: 50 })

    // Raw HTML blocks are not rendered by react-markdown without rehype-raw and should not
    // create blank pages by themselves.
    expect(pages.length).toBe(2)
    expect(pages[0]?.content).toContain(para)
    expect(pages[1]?.content).toContain(para)
  })

  it('treats nested raw HTML blocks as invisible for pagination sizing', () => {
    const para = 'D'.repeat(180)
    const html = `<INSTRUCTIONS>\n${'x'.repeat(2500)}\n</INSTRUCTIONS>`
    const listItem = html.split('\n').map((line, idx) => (idx === 0 ? `- ${line}` : `  ${line}`)).join('\n')
    const content = `# Title\n\n${para}\n\n${listItem}\n\n${para}\n`

    const { pages } = paginateMarkdown(content, { maxChars: 200, targetChars: 150, minChars: 50 })

    // Nested raw HTML inside a list item is still not rendered by react-markdown
    // without rehype-raw and should not create blank pages by itself.
    expect(pages.length).toBe(2)
    expect(pages[0]?.content).toContain(para)
    expect(pages[1]?.content).toContain(para)
  })
})
