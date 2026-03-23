// ============================================================================
// CompMapContext — Cross-canvas symbol resolution via React context
//
// Wraps PacketWorkspace to provide symbol resolution for all cards.
// Parses comp maps from packet content and builds the resolved symbol table.
// ============================================================================

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { parseCompMaps, buildSymbolTable } from '../../../../context-packet/src/aiccl/parseCompMaps'
import type { CompMap } from '../../../../context-packet/src/aiccl/types'

interface CompMapContextValue {
  /** All parsed comp maps */
  maps: CompMap[]
  /** Fully resolved symbol table (includes inherited symbols) */
  symbolTable: Map<string, string>
  /** Resolve a single symbol to its expansion */
  resolveSymbol: (symbol: string) => string
}

const CompMapCtx = createContext<CompMapContextValue>({
  maps: [],
  symbolTable: new Map(),
  resolveSymbol: (s) => s,
})

export function useCompMaps(): CompMapContextValue {
  return useContext(CompMapCtx)
}

interface CompMapProviderProps {
  /** Raw packet markdown content */
  packetContent: string
  children: ReactNode
}

export function CompMapProvider({ packetContent, children }: CompMapProviderProps) {
  const maps = useMemo(() => parseCompMaps(packetContent), [packetContent])
  const symbolTable = useMemo(() => buildSymbolTable(maps), [maps])

  const resolveSymbol = useMemo(() => {
    return (symbol: string): string => {
      return symbolTable.get(symbol) ?? symbol
    }
  }, [symbolTable])

  const value = useMemo(() => ({
    maps,
    symbolTable,
    resolveSymbol,
  }), [maps, symbolTable, resolveSymbol])

  return (
    <CompMapCtx.Provider value={value}>
      {children}
    </CompMapCtx.Provider>
  )
}
