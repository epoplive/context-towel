import React from 'react'
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { WidgetSpec } from '../core-widgets/types'
import { renderWidgetTree } from './WidgetRenderer'

describe('WidgetRenderer', () => {
  it('renders widget trees to markup', () => {
    const nodes: WidgetSpec[] = [
      { type: 'card', props: { title: 'Hello' }, children: [{ type: 'text', text: 'World' }] },
    ]
    const markup = renderToStaticMarkup(<>{renderWidgetTree(nodes)}</>)
    expect(markup).toContain('widget-card')
    expect(markup).toContain('Hello')
    expect(markup).toContain('World')
  })
})
