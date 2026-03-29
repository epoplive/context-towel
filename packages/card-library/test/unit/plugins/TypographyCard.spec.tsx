// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { TypographyCard } from '../../../src/plugins/typography/TypographyCard'
import { defaultTheme } from '../../../src/blocks/types'
import type { TypographyBlockData } from '../../../src/plugins/typography/types'

const baseProps = {
  detail: 'full' as const,
  theme: defaultTheme,
  source: { filePath: '', range: { startOffset: null, endOffset: null, startLine: null, endLine: null }, raw: '' },
}

describe('TypographyCard', () => {
  it('renders font family name', () => {
    const data: TypographyBlockData = { fontFamily: 'Inter' }
    const { container } = render(<TypographyCard data={data} {...baseProps} />)
    expect(container.textContent).toContain('Inter')
  })

  it('renders sample text', () => {
    const data: TypographyBlockData = { fontFamily: 'Playfair Display', sampleText: 'Hello World' }
    const { container } = render(<TypographyCard data={data} {...baseProps} />)
    expect(container.textContent).toContain('Hello World')
  })

  it('renders role badge', () => {
    const data: TypographyBlockData = { fontFamily: 'Inter', role: 'heading' }
    const { container } = render(<TypographyCard data={data} {...baseProps} />)
    expect(container.textContent).toContain('heading')
  })

  it('renders weight badge', () => {
    const data: TypographyBlockData = { fontFamily: 'Inter', weight: 700 }
    const { container } = render(<TypographyCard data={data} {...baseProps} />)
    expect(container.textContent).toContain('700')
  })

  it('renders alphabet sample', () => {
    const data: TypographyBlockData = { fontFamily: 'Inter' }
    const { container } = render(<TypographyCard data={data} {...baseProps} />)
    expect(container.textContent).toContain('ABCDEFGHIJKLMNOPQRSTUVWXYZ')
  })

  it('renders mini detail', () => {
    const data: TypographyBlockData = { fontFamily: 'Roboto' }
    const { container } = render(<TypographyCard data={data} {...baseProps} detail="mini" />)
    expect(container.textContent).toContain('Roboto')
  })
})
