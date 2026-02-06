// useFileParsing compat — stub for standalone use
// In LG this subscribes to FileParserService; here it returns empty data
// TODO: Wire to channel API for live parsing updates

import { useState, useCallback } from 'react'

export interface UseFileParsingOptions {
  autoWatch?: boolean
  initialParse?: boolean
  owner?: string
}

export interface UseFileParsingResult<T> {
  items: T[]
  byFile: Map<string, T[]>
  loading: boolean
  error: Error | null
  refresh: () => Promise<void>
}

export function useFileParsing<T = unknown>(
  _parserId: string,
  _pathPattern: string | RegExp,
  _options: UseFileParsingOptions = {}
): UseFileParsingResult<T> {
  const [items] = useState<T[]>([])
  const [byFile] = useState<Map<string, T[]>>(new Map())

  const refresh = useCallback(async () => {
    // No-op in standalone — data comes through channel API
  }, [])

  return { items, byFile, loading: false, error: null, refresh }
}
