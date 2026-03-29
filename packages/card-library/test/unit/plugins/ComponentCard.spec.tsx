// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { ComponentCard } from '../../../src/plugins/component/ComponentCard'
import { defaultTheme } from '../../../src/blocks/types'
import type { ComponentBlockData } from '../../../src/plugins/component/types'

const baseProps = {
  detail: 'full' as const,
  theme: defaultTheme,
  source: { filePath: '', range: { startOffset: null, endOffset: null, startLine: null, endLine: null }, raw: '' },
}

describe('ComponentCard', () => {
  it('renders component name', () => {
    const data: ComponentBlockData = { name: 'Primary Button' }
    const { container } = render(<ComponentCard data={data} {...baseProps} />)
    expect(container.textContent).toContain('Primary Button')
  })

  it('renders category badge', () => {
    const data: ComponentBlockData = { name: 'Button', category: 'buttons' }
    const { container } = render(<ComponentCard data={data} {...baseProps} />)
    expect(container.textContent).toContain('buttons')
  })

  it('renders variant pills', () => {
    const data: ComponentBlockData = { name: 'Button', variants: ['primary', 'secondary', 'ghost'] }
    const { container } = render(<ComponentCard data={data} {...baseProps} />)
    expect(container.textContent).toContain('primary')
    expect(container.textContent).toContain('secondary')
    expect(container.textContent).toContain('ghost')
  })

  it('renders preview HTML', () => {
    const data: ComponentBlockData = { name: 'Button', preview: '<button class="bg-indigo-600 text-white px-4 py-2">Click me</button>' }
    const { container } = render(<ComponentCard data={data} {...baseProps} />)
    expect(container.textContent).toContain('Preview')
    expect(container.querySelector('button')).toBeTruthy()
  })

  it('renders usage description', () => {
    const data: ComponentBlockData = { name: 'Button', usage: 'Use for primary actions' }
    const { container } = render(<ComponentCard data={data} {...baseProps} />)
    expect(container.textContent).toContain('Use for primary actions')
  })

  it('renders show code toggle', () => {
    const data: ComponentBlockData = { name: 'Button', code: '<button>Click</button>' }
    const { container } = render(<ComponentCard data={data} {...baseProps} />)
    expect(container.textContent).toContain('Show code')
  })

  it('renders props', () => {
    const data: ComponentBlockData = { name: 'Button', props: ['variant', 'size', 'disabled'] }
    const { container } = render(<ComponentCard data={data} {...baseProps} />)
    expect(container.textContent).toContain('variant')
    expect(container.textContent).toContain('size')
    expect(container.textContent).toContain('disabled')
  })

  it('renders mini detail', () => {
    const data: ComponentBlockData = { name: 'StatusBadge' }
    const { container } = render(<ComponentCard data={data} {...baseProps} detail="mini" />)
    expect(container.textContent).toContain('StatusBadge')
  })

  it('renders summary detail', () => {
    const data: ComponentBlockData = { name: 'Card', category: 'cards' }
    const { container } = render(<ComponentCard data={data} {...baseProps} detail="summary" />)
    expect(container.textContent).toContain('Card')
    expect(container.textContent).toContain('cards')
  })
})
