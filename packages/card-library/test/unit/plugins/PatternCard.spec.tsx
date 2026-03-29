// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { PatternCard } from '../../../src/plugins/pattern/PatternCard'
import { defaultTheme } from '../../../src/blocks/types'
import type { PatternBlockData } from '../../../src/plugins/pattern/types'

const baseProps = {
  detail: 'full' as const,
  theme: defaultTheme,
  source: { filePath: '', range: { startOffset: null, endOffset: null, startLine: null, endLine: null }, raw: '' },
}

describe('PatternCard', () => {
  it('renders pattern name', () => {
    const data: PatternBlockData = { name: 'Drag and Drop' }
    const { container } = render(<PatternCard data={data} {...baseProps} />)
    expect(container.textContent).toContain('Drag and Drop')
  })

  it('renders type badge', () => {
    const data: PatternBlockData = { name: 'Pattern', type: 'ui' }
    const { container } = render(<PatternCard data={data} {...baseProps} />)
    expect(container.textContent).toContain('ui')
  })

  it('renders priority badge', () => {
    const data: PatternBlockData = { name: 'Pattern', priority: 'high' }
    const { container } = render(<PatternCard data={data} {...baseProps} />)
    expect(container.textContent).toContain('high')
  })

  it('renders source and adaptation', () => {
    const data: PatternBlockData = { name: 'Pattern', source: 'Figma', adaptation: 'Use for our canvas' }
    const { container } = render(<PatternCard data={data} {...baseProps} />)
    expect(container.textContent).toContain('Figma')
    expect(container.textContent).toContain('Use for our canvas')
  })
})
