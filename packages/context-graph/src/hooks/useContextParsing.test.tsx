// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  useAllContextParsing,
  useContextChecklists,
  useContextTasks,
} from './useContextParsing'

const useFileParsingMock = vi.fn((..._args: any[]) => ({
  items: [],
  byFile: new Map(),
  loading: false,
  error: null,
  refresh: vi.fn(),
}))

vi.mock('../compat/useFileParsing', () => ({
  useFileParsing: (...args: [string, string | RegExp, any?]) => useFileParsingMock(...args),
}))

vi.mock('../plugins/fileParserAdapter', () => ({
  registerContextGraphParsers: vi.fn().mockResolvedValue(undefined),
}))

const flushPromises = async () => {
  await Promise.resolve()
  await new Promise((resolve) => setTimeout(resolve, 0))
}

const Harness = () => {
  useContextChecklists(null)
  useContextTasks('/projects/project-a/.context', { autoWatch: true, initialParse: true })
  useAllContextParsing('/projects/project-b/.context')
  return null
}

describe('useContextParsing hooks', () => {
  beforeEach(() => {
    useFileParsingMock.mockClear()
  })

  it('passes expected arguments to useFileParsing', async () => {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(<Harness />)
      await flushPromises()
    })

    expect(useFileParsingMock).toHaveBeenCalledWith(
      'checklist',
      '',
      expect.objectContaining({ autoWatch: false, initialParse: false, owner: 'context-checklists' })
    )
    expect(useFileParsingMock).toHaveBeenCalledWith(
      'task',
      '/projects/project-a/.context',
      expect.objectContaining({ autoWatch: true, initialParse: true, owner: 'context-tasks' })
    )
    expect(useFileParsingMock).toHaveBeenCalledWith(
      'diagram',
      '/projects/project-b/.context',
      expect.objectContaining({ owner: 'context-diagrams' })
    )
    expect(useFileParsingMock).toHaveBeenCalledWith(
      'toc',
      '/projects/project-b/.context',
      expect.objectContaining({ owner: 'context-toc' })
    )
    expect(useFileParsingMock).toHaveBeenCalledWith(
      'log',
      '/projects/project-b/.context',
      expect.objectContaining({ owner: 'context-logs' })
    )

    await act(async () => {
      root.unmount()
      await flushPromises()
    })
    container.remove()
  })
})
