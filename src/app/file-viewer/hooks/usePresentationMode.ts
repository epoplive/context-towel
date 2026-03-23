import { useState, useCallback, useRef } from 'react'

/** Fullscreen presentation mode state + lifecycle.
 *  Uses Tauri window fullscreen API (WKWebView doesn't support requestFullscreen).
 *  Falls back to CSS-only fullscreen overlay if Tauri APIs aren't available.
 */
export function usePresentationMode() {
  const [presentationMode, setPresentationMode] = useState(false)
  const wasFullscreenRef = useRef(false)

  const enterPresentation = useCallback(async () => {
    setPresentationMode(true)
    try {
      const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow')
      const win = getCurrentWebviewWindow()
      wasFullscreenRef.current = await win.isFullscreen()
      if (!wasFullscreenRef.current) await win.setFullscreen(true)
    } catch {
      // Non-Tauri or API unavailable — CSS overlay handles it
    }
  }, [])

  const exitPresentation = useCallback(async () => {
    setPresentationMode(false)
    try {
      const { getCurrentWebviewWindow } = await import('@tauri-apps/api/webviewWindow')
      const win = getCurrentWebviewWindow()
      if (!wasFullscreenRef.current) await win.setFullscreen(false)
    } catch {
      // Non-Tauri
    }
  }, [])

  return { presentationMode, enterPresentation, exitPresentation }
}
