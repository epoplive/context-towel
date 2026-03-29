// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { SitePageCard } from '../../../src/plugins/sitepage/SitePageCard'
import { defaultTheme } from '../../../src/blocks/types'
import type { SitePageBlockData } from '../../../src/plugins/sitepage/types'

const baseProps = {
  detail: 'full' as const,
  theme: defaultTheme,
  source: { filePath: '', range: { startOffset: null, endOffset: null, startLine: null, endLine: null }, raw: '' },
}

describe('SitePageCard', () => {
  it('renders page title', () => {
    const data: SitePageBlockData = { pageKey: 'home', title: 'Homepage' }
    const { container } = render(<SitePageCard data={data} {...baseProps} />)
    expect(container.textContent).toContain('Homepage')
  })

  it('renders slug', () => {
    const data: SitePageBlockData = { pageKey: 'home', title: 'Home', slug: '/home' }
    const { container } = render(<SitePageCard data={data} {...baseProps} />)
    expect(container.textContent).toContain('/home')
  })

  it('renders page type badge', () => {
    const data: SitePageBlockData = { pageKey: 'dash', title: 'Dashboard', pageType: 'dashboard' }
    const { container } = render(<SitePageCard data={data} {...baseProps} />)
    expect(container.textContent).toContain('dashboard')
  })

  it('renders priority badge', () => {
    const data: SitePageBlockData = { pageKey: 'home', title: 'Home', priority: 'must-have' }
    const { container } = render(<SitePageCard data={data} {...baseProps} />)
    expect(container.textContent).toContain('must-have')
  })

  it('renders sections', () => {
    const data: SitePageBlockData = { pageKey: 'home', title: 'Home', sections: ['Hero', 'Features'] }
    const { container } = render(<SitePageCard data={data} {...baseProps} />)
    expect(container.textContent).toContain('Hero')
    expect(container.textContent).toContain('Features')
  })
})
