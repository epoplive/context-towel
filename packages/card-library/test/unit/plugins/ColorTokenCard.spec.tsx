// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ColorTokenCard } from '../../../src/plugins/color-token/ColorTokenCard'
import { defaultTheme } from '../../../src/blocks/types'
import type { ColorTokenBlockData } from '../../../src/plugins/color-token/types'

const baseProps = {
  detail: 'full' as const,
  theme: defaultTheme,
  source: { filePath: '', range: { startOffset: null, endOffset: null, startLine: null, endLine: null }, raw: '' },
}

describe('ColorTokenCard', () => {
  it('renders token name', () => {
    const data: ColorTokenBlockData = { name: 'background', value: '#FFFFFF' }
    const { container } = render(<ColorTokenCard data={data} {...baseProps} />)
    expect(container.textContent).toContain('background')
  })

  it('renders hex value', () => {
    const data: ColorTokenBlockData = { name: 'bg', value: '#4F46E5' }
    const { container } = render(<ColorTokenCard data={data} {...baseProps} />)
    expect(container.textContent).toContain('#4F46E5')
  })

  it('renders dark mode value when provided', () => {
    const data: ColorTokenBlockData = { name: 'bg', value: '#4F46E5', darkValue: '#818CF8' }
    const { container } = render(<ColorTokenCard data={data} {...baseProps} />)
    expect(container.textContent).toContain('#818CF8')
    expect(container.textContent).toContain('dark')
  })

  it('renders role badge', () => {
    const data: ColorTokenBlockData = { name: 'bg', value: '#FFF', role: 'background' }
    const { container } = render(<ColorTokenCard data={data} {...baseProps} />)
    expect(container.textContent).toContain('background')
  })

  it('renders group badge', () => {
    const data: ColorTokenBlockData = { name: 'bg', value: '#FFF', group: 'utility' }
    const { container } = render(<ColorTokenCard data={data} {...baseProps} />)
    expect(container.textContent).toContain('utility')
  })

  it('renders mini detail', () => {
    const data: ColorTokenBlockData = { name: 'accent', value: '#F00' }
    const { container } = render(<ColorTokenCard data={data} {...baseProps} detail="mini" />)
    expect(container.textContent).toContain('accent')
  })
})
