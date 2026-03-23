import type { Dispatch, SetStateAction } from 'react'
import { MarkdownEditor } from '@context-towel/editor'
import type { BlockEditEvent, ThemeTokens } from '@context-towel/card-library'
import type { SmartSlide } from './types'

interface PresentationModeProps {
  slide: SmartSlide
  currentPage: number
  totalPages: number
  setCurrentPage: Dispatch<SetStateAction<number>>
  onExit: () => void
  onEditBlock: (event: BlockEditEvent) => void
  theme: ThemeTokens
  isDark: boolean
}

export function PresentationMode({
  slide,
  currentPage,
  totalPages,
  setCurrentPage,
  onExit,
  onEditBlock,
  theme,
  isDark,
}: PresentationModeProps) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: '#0d0d0d',
        color: '#e8e8e8',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '26px',
      }}
    >
      {/* Left nav arrow */}
      <button
        onClick={() => setCurrentPage(p => Math.max(p - 1, 0))}
        disabled={currentPage === 0}
        style={{
          position: 'absolute',
          left: 24,
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'none',
          border: 'none',
          color: currentPage === 0 ? '#444' : '#888',
          fontSize: 32,
          cursor: currentPage === 0 ? 'default' : 'pointer',
          padding: '8px 12px',
          lineHeight: 1,
        }}
        title="Previous slide"
      >
        ‹
      </button>

      {/* Slide content */}
      <div
        style={{
          maxWidth: 1100,
          width: '100%',
          maxHeight: '100vh',
          overflow: 'auto',
          padding: '60px 80px',
          boxSizing: 'border-box',
        }}
      >
        {slide.content.trim() ? (
          <MarkdownEditor
            content={slide.content}
            editable={false}
            onCardEdit={onEditBlock}
            theme={theme}
            isDark={isDark}
          />
        ) : (
          <div style={{ color: '#555', fontStyle: 'italic', textAlign: 'center', fontSize: '0.65em' }}>
            This section has no content
          </div>
        )}
      </div>

      {/* Right nav arrow */}
      <button
        onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages - 1))}
        disabled={currentPage === totalPages - 1}
        style={{
          position: 'absolute',
          right: 24,
          top: '50%',
          transform: 'translateY(-50%)',
          background: 'none',
          border: 'none',
          color: currentPage === totalPages - 1 ? '#444' : '#888',
          fontSize: 32,
          cursor: currentPage === totalPages - 1 ? 'default' : 'pointer',
          padding: '8px 12px',
          lineHeight: 1,
        }}
        title="Next slide"
      >
        ›
      </button>

      {/* Exit button */}
      <button
        onClick={onExit}
        style={{
          position: 'absolute',
          top: 16,
          right: 20,
          background: 'none',
          border: 'none',
          color: '#666',
          fontSize: 22,
          cursor: 'pointer',
          lineHeight: 1,
          padding: '4px 8px',
        }}
        title="Exit presentation (Esc)"
      >
        ✕
      </button>

      {/* Slide counter */}
      <div
        style={{
          position: 'absolute',
          bottom: 16,
          right: 24,
          color: '#555',
          fontSize: '0.5em',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {currentPage + 1}/{totalPages}
      </div>
    </div>
  )
}
