// ESM shim for use-sync-external-store/shim
// React 18+ has useSyncExternalStore built-in, so we re-export it directly.
// This avoids bundling the CJS-only shim package which uses require("react").
import { useSyncExternalStore } from 'react'
export { useSyncExternalStore }
