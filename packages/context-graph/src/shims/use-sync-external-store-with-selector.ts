// ESM shim for use-sync-external-store/shim/with-selector
// Provides useSyncExternalStoreWithSelector using React 18+'s built-in
// useSyncExternalStore, avoiding the CJS-only shim that uses require("react").

import { useSyncExternalStore, useRef, useEffect, useMemo, useDebugValue } from 'react'

function is(x: unknown, y: unknown): boolean {
  return (x === y && (0 !== x || 1 / x === 1 / (y as number))) || (x !== x && y !== y)
}

const objectIs = typeof Object.is === 'function' ? Object.is : is

export function useSyncExternalStoreWithSelector<Snapshot, Selection>(
  subscribe: (onStoreChange: () => void) => () => void,
  getSnapshot: () => Snapshot,
  getServerSnapshot: undefined | null | (() => Snapshot),
  selector: (snapshot: Snapshot) => Selection,
  isEqual?: (a: Selection, b: Selection) => boolean,
): Selection {
  const instRef = useRef<{ hasValue: boolean; value: Selection | null }>(null)
  if (instRef.current === null) {
    instRef.current = { hasValue: false, value: null }
  }
  const inst = instRef.current

  const [getSelection, getServerSelection] = useMemo(() => {
    let hasMemo = false
    let memoizedSnapshot: Snapshot
    let memoizedSelection: Selection

    const memoizedSelector = (nextSnapshot: Snapshot): Selection => {
      if (!hasMemo) {
        hasMemo = true
        memoizedSnapshot = nextSnapshot
        const nextSelection = selector(nextSnapshot)
        if (isEqual !== undefined && inst.hasValue) {
          const currentSelection = inst.value as Selection
          if (isEqual(currentSelection, nextSelection)) {
            memoizedSelection = currentSelection
            return currentSelection
          }
        }
        memoizedSelection = nextSelection
        return nextSelection
      }
      const currentSelection = memoizedSelection
      if (objectIs(memoizedSnapshot, nextSnapshot)) return currentSelection
      const nextSelection = selector(nextSnapshot)
      if (isEqual !== undefined && isEqual(currentSelection, nextSelection)) {
        memoizedSnapshot = nextSnapshot
        return currentSelection
      }
      memoizedSnapshot = nextSnapshot
      memoizedSelection = nextSelection
      return nextSelection
    }

    const maybeGetServerSnapshot = getServerSnapshot === undefined ? null : getServerSnapshot
    return [
      () => memoizedSelector(getSnapshot()),
      maybeGetServerSnapshot === null ? undefined : () => memoizedSelector(maybeGetServerSnapshot()),
    ] as const
  }, [getSnapshot, getServerSnapshot, selector, isEqual])

  const value = useSyncExternalStore(subscribe, getSelection, getServerSelection)
  useEffect(() => {
    inst.hasValue = true
    inst.value = value
  }, [value])
  useDebugValue(value)
  return value
}

export default { useSyncExternalStoreWithSelector }
