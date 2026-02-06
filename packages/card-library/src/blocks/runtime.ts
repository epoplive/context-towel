import { blockRegistry } from './registry'
import type { BlockInstance, BlockParseError, BlockRuntime } from './types'
import { toJsonRuntime } from './adapter'

export type BlockRuntimeResult<T = unknown> = {
  block: BlockRuntime<T> | null
  errors: BlockParseError[]
}

export type RuntimePatch =
  | {
      op: 'set'
      path: Array<string | number>
      value: unknown
    }
  | {
      op: 'merge'
      path: Array<string | number>
      value: Record<string, unknown>
    }
  | {
      op: 'append'
      path: Array<string | number>
      value: unknown | unknown[]
    }
  | {
      op: 'unset'
      path: Array<string | number>
    }

export function toRuntimeBlock<T = unknown>(block: BlockInstance<T>): BlockRuntimeResult<T> {
  const errors: BlockParseError[] = [...(block.errors ?? [])]
  const definition = blockRegistry.get(block.type)
  if (!definition) {
    return { block: null, errors: [...errors, { message: `Unknown block type: ${block.type}` }] }
  }
  if (block.data == null) {
    return { block: null, errors }
  }

  let validationErrors = definition.validate ? definition.validate(block.data as T) : []
  if (!definition.validate) {
    if (block.data === null || typeof block.data !== 'object' || Array.isArray(block.data)) {
      validationErrors = [{ message: 'Block data must be a YAML mapping (object).' }]
    }
  }
  if (validationErrors.length > 0) {
    errors.push(...validationErrors)
  }

  if (errors.length > 0) {
    return { block: null, errors }
  }

  let runtimeData: T
  try {
    runtimeData = definition.toRuntime
      ? (definition.toRuntime(block.data as T) as T)
      : toJsonRuntime(block.data as T)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to normalize block data.'
    return { block: null, errors: [...errors, { message }] }
  }

  return {
    block: {
      type: block.type,
      schemaVersion: definition.schemaVersion ?? 1,
      data: runtimeData,
    },
    errors: [],
  }
}

export function toRuntimeBlocks<T = unknown>(blocks: BlockInstance<T>[]): Array<BlockRuntimeResult<T>> {
  return blocks.map(block => toRuntimeBlock(block))
}

const setPathValue = (target: any, path: Array<string | number>, value: unknown): void => {
  if (path.length === 0) return
  let cursor = target
  for (let i = 0; i < path.length - 1; i += 1) {
    const key = path[i]
    const nextKey = path[i + 1]
    if (cursor[key] == null) {
      cursor[key] = typeof nextKey === 'number' ? [] : {}
    }
    cursor = cursor[key]
  }
  cursor[path[path.length - 1]] = value
}

const getPathValue = (target: any, path: Array<string | number>): any => {
  if (path.length === 0) return target
  let cursor = target
  for (let i = 0; i < path.length; i += 1) {
    if (cursor == null) return undefined
    cursor = cursor[path[i]]
  }
  return cursor
}

const deletePathValue = (target: any, path: Array<string | number>): void => {
  if (path.length === 0) return
  let cursor = target
  for (let i = 0; i < path.length - 1; i += 1) {
    if (cursor == null) return
    cursor = cursor[path[i]]
  }
  const key = path[path.length - 1]
  if (Array.isArray(cursor) && typeof key === 'number') {
    cursor.splice(key, 1)
  } else if (cursor && typeof cursor === 'object') {
    delete cursor[key]
  }
}

const mergeDeep = (target: any, source: any): any => {
  if (!source || typeof source !== 'object' || Array.isArray(source)) {
    return source
  }
  if (!target || typeof target !== 'object' || Array.isArray(target)) {
    target = {}
  }
  Object.keys(source).forEach(key => {
    const srcValue = source[key]
    const tgtValue = target[key]
    if (srcValue && typeof srcValue === 'object' && !Array.isArray(srcValue)) {
      target[key] = mergeDeep(tgtValue, srcValue)
    } else {
      target[key] = srcValue
    }
  })
  return target
}

export function applyRuntimePatches<T = unknown>(data: T, patches: RuntimePatch[]): T {
  const next = toJsonRuntime(data)
  patches.forEach(patch => {
    if (patch.op === 'set') {
      setPathValue(next as any, patch.path, patch.value)
    } else if (patch.op === 'merge') {
      if (patch.path.length === 0) {
        mergeDeep(next as any, patch.value)
      } else {
        const current = getPathValue(next as any, patch.path)
        const merged = mergeDeep(current, patch.value)
        setPathValue(next as any, patch.path, merged)
      }
    } else if (patch.op === 'append') {
      const current = getPathValue(next as any, patch.path)
      const values = Array.isArray(patch.value) ? patch.value : [patch.value]
      if (Array.isArray(current)) {
        current.push(...values)
      } else {
        setPathValue(next as any, patch.path, [...values])
      }
    } else if (patch.op === 'unset') {
      deletePathValue(next as any, patch.path)
    }
  })
  return next
}
