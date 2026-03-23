import { useEffect, type Dispatch, type SetStateAction } from 'react'
import type { ViewMode } from '../types'

/** Keyboard navigation for slideshow (normal + presentation mode). */
export function useSlideshowKeyboard(
  viewMode: ViewMode,
  totalPages: number,
  setCurrentPage: Dispatch<SetStateAction<number>>,
  presentationMode: boolean,
  exitPresentation: () => void,
) {
  useEffect(() => {
    if (viewMode !== 'slideshow') return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault()
        setCurrentPage(p => Math.min(p + 1, totalPages - 1))
      }
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp' || e.key === 'Backspace') {
        e.preventDefault()
        setCurrentPage(p => Math.max(p - 1, 0))
      }
      if (e.key === 'Escape' && presentationMode) {
        exitPresentation()
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [viewMode, totalPages, presentationMode, setCurrentPage, exitPresentation])
}
