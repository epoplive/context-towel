// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { CompetitorCard } from '../../../src/plugins/competitor/CompetitorCard'
import { defaultTheme } from '../../../src/blocks/types'
import type { CompetitorBlockData } from '../../../src/plugins/competitor/types'

const baseProps = {
  detail: 'full' as const,
  theme: defaultTheme,
  source: { filePath: '', range: { startOffset: null, endOffset: null, startLine: null, endLine: null }, raw: '' },
}

describe('CompetitorCard', () => {
  it('renders competitor name', () => {
    const data: CompetitorBlockData = { name: 'Acme Corp' }
    const { container } = render(<CompetitorCard data={data} {...baseProps} />)
    expect(container.textContent).toContain('Acme Corp')
  })

  it('renders URL as link', () => {
    const data: CompetitorBlockData = { name: 'Acme', url: 'https://acme.com' }
    const { container } = render(<CompetitorCard data={data} {...baseProps} />)
    expect(container.textContent).toContain('acme.com')
  })

  it('renders color swatches', () => {
    const data: CompetitorBlockData = { name: 'Acme', extractedColors: ['#ff0000', '#00ff00'] }
    const { container } = render(<CompetitorCard data={data} {...baseProps} />)
    expect(container.textContent).toContain('Colors:')
  })

  it('renders strengths and weaknesses', () => {
    const data: CompetitorBlockData = { name: 'Acme', strengths: ['Fast'], weaknesses: ['Expensive'] }
    const { container } = render(<CompetitorCard data={data} {...baseProps} />)
    expect(container.textContent).toContain('Strengths')
    expect(container.textContent).toContain('Weaknesses')
    expect(container.textContent).toContain('Fast')
    expect(container.textContent).toContain('Expensive')
  })

  it('renders mini detail level', () => {
    const data: CompetitorBlockData = { name: 'Acme Corp' }
    const { container } = render(<CompetitorCard data={data} {...baseProps} detail="mini" />)
    expect(container.textContent).toContain('Acme Corp')
  })

  it('renders summary detail level', () => {
    const data: CompetitorBlockData = { name: 'Acme', description: 'A great company' }
    const { container } = render(<CompetitorCard data={data} {...baseProps} detail="summary" />)
    expect(container.textContent).toContain('A great company')
  })
})
