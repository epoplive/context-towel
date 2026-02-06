// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { describe, expect, it, vi } from 'vitest'

let lastDocumentGraphProps: any = null

vi.mock('./DocumentGraph', () => ({
  DocumentGraph: (props: any) => {
    lastDocumentGraphProps = props
    return <div data-testid="document-graph" />
  },
}))

vi.mock('../../../app/panels', () => ({
  useOpenFileAction: () => null,
  useProjectSettingsByPath: () => ({}),
}))

vi.mock('../../design-system', () => ({
  useTheme: () => ({
    colors: {
      bgPrimary: '#111',
      textMuted: '#888',
    },
  }),
}))

describe('ContextGraphPanel', () => {
  it('passes projectPath to DocumentGraph', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    const { ContextGraphPanel } = await import('./ContextGraphPanel')

    await act(async () => {
      root.render(<ContextGraphPanel projectPath="/proj/alpha" />)
    })

    expect(lastDocumentGraphProps?.projectPath).toBe('/proj/alpha')
    act(() => root.unmount())
    container.remove()
  })
})
