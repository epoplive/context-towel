// Window visibility hook — same as LG's, no external deps

import { useState, useEffect } from 'react'

export interface WindowVisibilityState {
  isFocused: boolean
  isHidden: boolean
  visibilityState: DocumentVisibilityState
}

export function useWindowVisibility(): WindowVisibilityState {
  const [state, setState] = useState<WindowVisibilityState>({
    isFocused: document.hasFocus(),
    isHidden: document.hidden,
    visibilityState: document.visibilityState,
  })

  useEffect(() => {
    const handleVisibility = () => {
      setState({
        isFocused: document.hasFocus(),
        isHidden: document.hidden,
        visibilityState: document.visibilityState,
      })
    }
    const handleFocus = () => setState(prev => ({ ...prev, isFocused: true }))
    const handleBlur = () => setState(prev => ({ ...prev, isFocused: false }))

    document.addEventListener('visibilitychange', handleVisibility)
    window.addEventListener('focus', handleFocus)
    window.addEventListener('blur', handleBlur)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      window.removeEventListener('focus', handleFocus)
      window.removeEventListener('blur', handleBlur)
    }
  }, [])

  return state
}
