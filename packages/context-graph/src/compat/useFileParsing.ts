// useFileParsing compat — shared hook for host apps (Looking Glass / Felix / etc.)
//
// Implemented against the extracted compat `fileService` + `fileParserService`
// interfaces, so any host can opt-in by calling `configureCompatServices()`.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fileService, fileParserService, type ParsedFileData } from './services'

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
  parserId: string,
  pathPattern: string | RegExp,
  options: UseFileParsingOptions = {}
): UseFileParsingResult<T> {
  const autoWatch = options.autoWatch ?? false
  const initialParse = options.initialParse ?? false
  const owner = options.owner ?? 'use-file-parsing'

  const [items, setItems] = useState<T[]>([])
  const [byFile, setByFile] = useState<Map<string, T[]>>(new Map())
  const [loading, setLoading] = useState<boolean>(initialParse)
  const [error, setError] = useState<Error | null>(null)

  const mountedRef = useRef(true)
  const watchedPathRef = useRef<string | null>(typeof pathPattern === 'string' ? pathPattern : null)

  const flatten = useCallback((nextByFile: Map<string, T[]>) => {
    const all: T[] = []
    for (const fileItems of nextByFile.values()) {
      all.push(...fileItems)
    }
    return all
  }, [])

  const extractItems = useCallback((data: ParsedFileData | null | undefined): T[] => {
    if (!data) return []
    const result = data.results.get(parserId)
    const raw = result?.items ?? []
    return raw as T[]
  }, [parserId])

  const hydrateFromCache = useCallback(async () => {
    const rootPath = watchedPathRef.current
    if (!rootPath) return

    try {
      // Context-graph parsers target markdown; limit enumeration to markdown-ish files.
      const files = await fileService.listAllFiles(rootPath, ['.md', '.markdown', '.mdx'])
      const next = new Map<string, T[]>()
      for (const filePath of files) {
        const cached = fileParserService.getCachedFile(filePath)
        const fileItems = extractItems(cached)
        if (fileItems.length > 0) next.set(filePath, fileItems)
      }
      if (!mountedRef.current) return
      setByFile(next)
      setItems(flatten(next))
    } catch (err) {
      // Best-effort optimization only; ignore failures (noop compat, missing FS, etc).
      void err
    }
  }, [extractItems, flatten])

  const refresh = useCallback(async () => {
    const rootPath = watchedPathRef.current
    setLoading(true)
    setError(null)

    try {
      if (rootPath) {
        const files = await fileService.listAllFiles(rootPath, ['.md', '.markdown', '.mdx'])
        const next = new Map<string, T[]>()

        // Parse sequentially to avoid spiking CPU on large workspaces.
        for (const filePath of files) {
          const parsed = await fileParserService.parseFile(filePath)
          const fileItems = extractItems(parsed)
          if (fileItems.length > 0) next.set(filePath, fileItems)
        }

        if (!mountedRef.current) return
        setByFile(next)
        setItems(flatten(next))
      } else {
        // RegExp patterns cannot be enumerated safely; reparse currently tracked files.
        const next = new Map(byFile)
        for (const filePath of next.keys()) {
          const parsed = await fileParserService.parseFile(filePath)
          const fileItems = extractItems(parsed)
          if (fileItems.length > 0) next.set(filePath, fileItems)
          else next.delete(filePath)
        }
        if (!mountedRef.current) return
        setByFile(next)
        setItems(flatten(next))
      }
    } catch (err) {
      if (!mountedRef.current) return
      setError(err instanceof Error ? err : new Error(String(err)))
    } finally {
      if (!mountedRef.current) return
      setLoading(false)
    }
  }, [byFile, extractItems, flatten])

  // Subscribe to updates from the host parser cache.
  useEffect(() => {
    mountedRef.current = true
    const unsubscribe = fileParserService.subscribeAll(pathPattern, (filePath, data) => {
      const fileItems = extractItems(data)
      setByFile((prev) => {
        const next = new Map(prev)
        if (fileItems.length > 0) next.set(filePath, fileItems)
        else next.delete(filePath)
        setItems(flatten(next))
        setLoading(false)
        return next
      })
    })

    return () => {
      mountedRef.current = false
      unsubscribe()
    }
  }, [extractItems, flatten, pathPattern])

  // Fast-path: show cached data immediately if another part of the app already parsed.
  useEffect(() => {
    void hydrateFromCache()
  }, [hydrateFromCache])

  // Optional: own watching/parsing lifecycle.
  useEffect(() => {
    const rootPath = watchedPathRef.current
    if (!rootPath) return

    let unwatch: (() => void) | null = null

    const init = async () => {
      if (autoWatch) {
        setLoading(true)
        unwatch = await fileParserService.watchAndParse(rootPath, [parserId], owner)
      } else if (initialParse) {
        await refresh()
      }
    }
    void init()

    return () => {
      if (unwatch) unwatch()
    }
  }, [autoWatch, initialParse, owner, parserId, refresh])

  return useMemo(
    () => ({ items, byFile, loading, error, refresh }),
    [items, byFile, loading, error, refresh]
  )
}
