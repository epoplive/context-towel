import React from 'react'
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { WidgetMarkdownRenderer } from './WidgetMarkdownRenderer'

describe('WidgetMarkdownRenderer', () => {
  it('renders widget markup with widget renderer', () => {
    const markup = renderToStaticMarkup(
      <WidgetMarkdownRenderer content={'<Card title="Test"><Text>Hello</Text></Card>'} />
    )
    expect(markup).toContain('widget-card')
    expect(markup).toContain('Test')
    expect(markup).toContain('Hello')
  })

  it('renders legacy task blocks via markdown renderer', () => {
    const content = [
      '```task',
      'title: Task Title',
      'status: todo',
      'priority: low',
      'checklist: |',
      '  - [x] Done',
      '  - [ ] Next',
      '```',
    ].join('\n')

    const markup = renderToStaticMarkup(<WidgetMarkdownRenderer content={content} />)
    expect(markup).toContain('markdown-body')
    expect(markup).not.toContain('widget-card')
  })

  it('renders markdown when widget tags appear inside code blocks', () => {
    const content = [
      '# Sample',
      '```md',
      '<Card title="Example"><Text>Hello</Text></Card>',
      '```',
      '- List item',
    ].join('\n')

    const markup = renderToStaticMarkup(<WidgetMarkdownRenderer content={content} />)
    expect(markup).toContain('markdown-body')
    expect(markup).not.toContain('widget-card')
  })

  it('renders widget cards alongside markdown content', () => {
    const content = [
      '# Overview',
      '',
      '<Card title="Status"><Text>All green</Text></Card>',
      '',
      '- Next steps',
    ].join('\n')

    const markup = renderToStaticMarkup(<WidgetMarkdownRenderer content={content} />)
    expect(markup).toContain('markdown-body')
    expect(markup).toContain('widget-card')
    expect(markup).toContain('Status')
  })
})
