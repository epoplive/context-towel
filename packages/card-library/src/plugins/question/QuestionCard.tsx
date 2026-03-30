import { memo, useState } from 'react'
import {
  MessageSquare, ChevronRight, ChevronLeft, Check, Circle, CheckCircle2, Type,
} from 'lucide-react'
import type { BlockRenderProps } from '../../blocks/types'
import type { QuestionBlockData, QuestionOption } from './types'

/** Lightweight inline markdown → HTML for choice labels. Handles **bold**, *italic*, `code`, and passes HTML through. */
function simpleMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code style="background:rgba(0,0,0,0.06);padding:1px 4px;border-radius:3px;font-size:0.9em">$1</code>')
}

/** Question card — renders interactive option picker at different detail levels */
export const QuestionCard = memo(function QuestionCard({
  data,
  detail,
  theme,
  onEdit,
}: BlockRenderProps<QuestionBlockData>) {
  // Pre-populate from saved response field
  const initialSelected = (() => {
    if (data.response) return { single: data.response }
    if (data.responses) return data.responses as Record<string, string | string[]>
    return {}
  })()
  const [selected, setSelected] = useState<Record<string, string | string[]>>(initialSelected)
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [textInput, setTextInput] = useState('')

  const isSubmitted = data.submitted === true || submitted
  const isReadOnly = !onEdit
  const isMultiQuestion = !!data.questions && data.questions.length > 0
  const questionColor = '#3b82f6' // Blue for questions

  if (detail === 'mini') {
    const displayText = data.title || data.text || 'Question'
    return (
      <div style={{
        borderLeft: `3px solid ${questionColor}`,
        padding: '4px 8px',
        background: theme.bgSecondary,
        borderRadius: theme.radius,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: theme.fontSans,
      }}>
        <MessageSquare size={10} color={questionColor} style={{ flexShrink: 0 }} />
        <span style={{
          fontSize: '0.95em',
          color: theme.textPrimary,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
        }}>
          {displayText}
        </span>
      </div>
    )
  }

  if (detail === 'summary') {
    const displayText = data.title || data.text || 'Question'
    const optionCount = isMultiQuestion
      ? data.questions!.length
      : (data.options?.length || 0)

    return (
      <div style={{
        borderLeft: `3px solid ${questionColor}`,
        padding: '6px 8px',
        background: theme.bgSecondary,
        borderRadius: theme.radius,
        fontFamily: theme.fontSans,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <MessageSquare size={10} color={questionColor} style={{ flexShrink: 0 }} />
          <span style={{
            fontSize: '0.95em',
            color: theme.textPrimary,
            fontWeight: 600,
            flex: 1,
          }}>
            {displayText}
          </span>
          {optionCount > 0 && (
            <span style={{
              fontSize: '0.75em',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              padding: '1px 5px',
              borderRadius: 3,
              background: `${questionColor}22`,
              color: questionColor,
            }}>
              {isMultiQuestion ? `${optionCount} Q` : `${optionCount} OPT`}
            </span>
          )}
        </div>
      </div>
    )
  }

  // detail === 'full'

  // Normalize option helper
  const normalizeOption = (opt: string | QuestionOption): QuestionOption => {
    if (typeof opt === 'string') {
      return { id: opt, label: opt }
    }
    return opt
  }

  const handleSubmit = () => {
    const responses = { ...selected }
    if (data.allowText && textInput) {
      responses['__text__'] = textInput
    }
    onEdit?.({ blockType: 'question', field: 'submit', value: { responses }, blockId: data.text ?? data.title })
    setSubmitted(true)
  }

  const handleOptionClick = (questionId: string, optionId: string, isMulti: boolean) => {
    if (isSubmitted) return

    let newSelected: Record<string, string | string[]>
    if (isMulti) {
      const raw = selected[questionId] || []
      const current = Array.isArray(raw) ? raw : [raw] as string[]
      const exists = current.includes(optionId)
      newSelected = {
        ...selected,
        [questionId]: exists
          ? current.filter(id => id !== optionId)
          : [...current, optionId],
      }
    } else {
      newSelected = { ...selected, [questionId]: optionId }
    }
    setSelected(newSelected)

    // Auto-save: fire onEdit immediately on selection
    if (onEdit) {
      onEdit({ blockType: 'question', field: 'submit', value: { responses: newSelected }, blockId: data.text ?? data.title })
    }
  }

  // Read-only view: after submission, or when no onEdit (display mode)
  if (isSubmitted || isReadOnly) {
    const displayResponses = data.responses || selected
    const hasResponses = Object.keys(displayResponses).length > 0

    return (
      <div style={{
        borderLeft: `3px solid ${questionColor}`,
        padding: '8px 10px',
        background: theme.bgSecondary,
        borderRadius: theme.radius,
        fontFamily: theme.fontSans,
        opacity: isSubmitted ? 0.8 : 1,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <MessageSquare size={12} color={questionColor} style={{ flexShrink: 0 }} />
          <span style={{
            fontSize: '1em',
            color: theme.textPrimary,
            fontWeight: 600,
            flex: 1,
          }}>
            {data.title || data.text || 'Question'}
          </span>
          {isSubmitted && (
            <span style={{
              fontSize: '0.75em',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              padding: '1px 5px',
              borderRadius: 3,
              background: `${theme.success}22`,
              color: theme.success,
            }}>
              SUBMITTED
            </span>
          )}
          {isReadOnly && !isSubmitted && (
            <span style={{
              fontSize: '0.75em',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              padding: '1px 5px',
              borderRadius: 3,
              background: `${questionColor}22`,
              color: questionColor,
            }}>
              PENDING
            </span>
          )}
        </div>

        {/* Show responses or available options */}
        {isMultiQuestion ? (
          data.questions!.map((q, idx) => {
            const qId = q.id || `q${idx}`
            const response = displayResponses[qId]
            return (
              <div key={qId} style={{ marginBottom: 6 }}>
                <div style={{
                  fontSize: '0.9em',
                  color: theme.textPrimary,
                  marginBottom: 2,
                  fontWeight: 500,
                }}>
                  {q.text}
                </div>
                {hasResponses ? (
                  <div style={{
                    fontSize: '0.85em',
                    color: theme.textSecondary,
                    paddingLeft: 8,
                  }}>
                    {Array.isArray(response)
                      ? response.join(', ')
                      : String(response || 'Awaiting answer')}
                  </div>
                ) : q.options && q.options.length > 0 ? (
                  <div style={{ paddingLeft: 8, display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                    {q.options.map(opt => {
                      const o = typeof opt === 'string' ? { id: opt, label: opt } : opt
                      return (
                        <span key={o.id} style={{
                          fontSize: '0.8em',
                          padding: '2px 8px',
                          borderRadius: 12,
                          border: `1px solid ${theme.borderSecondary}`,
                          color: theme.textSecondary,
                        }}>
                          {o.label}
                        </span>
                      )
                    })}
                  </div>
                ) : null}
              </div>
            )
          })
        ) : data.options && data.options.length > 0 && !hasResponses ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
            {data.options.map(opt => {
              const o = typeof opt === 'string' ? { id: opt, label: opt } : opt
              return (
                <span key={o.id} style={{
                  fontSize: '0.8em',
                  padding: '2px 8px',
                  borderRadius: 12,
                  border: `1px solid ${theme.borderSecondary}`,
                  color: theme.textSecondary,
                }}>
                  {o.label}
                </span>
              )
            })}
          </div>
        ) : (
          <div style={{
            fontSize: '0.9em',
            color: theme.textSecondary,
            marginBottom: 4,
          }}>
            {Array.isArray(displayResponses['single'])
              ? displayResponses['single'].join(', ')
              : String(displayResponses['single'] || 'No answer')}
          </div>
        )}
      </div>
    )
  }

  // Interactive mode - Single question
  if (!isMultiQuestion) {
    const normalizedOptions = (data.options || []).map(normalizeOption)
    const isMulti = data.multi || false
    const selectedIds = isMulti
      ? ((selected['single'] || []) as string[])
      : (selected['single'] ? [selected['single'] as string] : [])

    return (
      <div style={{
        borderLeft: `3px solid ${questionColor}`,
        padding: '8px 10px',
        background: theme.bgSecondary,
        borderRadius: theme.radius,
        fontFamily: theme.fontSans,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <MessageSquare size={12} color={questionColor} style={{ flexShrink: 0 }} />
          <span style={{
            fontSize: '1em',
            color: theme.textPrimary,
            fontWeight: 600,
          }}>
            {data.text || 'Question'}
          </span>
        </div>

        {/* Options */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
          {normalizedOptions.map(opt => {
            const isSelected = selectedIds.includes(opt.id)
            const Icon = isMulti ? (isSelected ? CheckCircle2 : Circle) : (isSelected ? Check : Circle)

            return (
              <button
                key={opt.id}
                onClick={() => handleOptionClick('single', opt.id, isMulti)}
                style={{
                  padding: '8px 14px',
                  borderRadius: 20,
                  border: `1px solid ${isSelected ? theme.accent : theme.borderSecondary}`,
                  background: isSelected ? theme.accent : theme.bgTertiary,
                  color: isSelected ? theme.textInverse : theme.textPrimary,
                  cursor: 'pointer',
                  fontSize: '0.9em',
                  fontFamily: theme.fontSans,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.15s ease',
                  textAlign: 'left',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = theme.bgSecondary
                    e.currentTarget.style.borderColor = theme.accent
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = theme.bgTertiary
                    e.currentTarget.style.borderColor = theme.borderSecondary
                  }
                }}
              >
                <Icon size={12} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 500 }} dangerouslySetInnerHTML={{ __html: simpleMarkdown(opt.label) }} />
                  {opt.description && (
                    <div style={{
                      fontSize: '0.85em',
                      marginTop: 2,
                      opacity: 0.8,
                    }} dangerouslySetInnerHTML={{ __html: simpleMarkdown(opt.description) }} />
                  )}
                </div>
              </button>
            )
          })}
        </div>

        {/* Text input if allowed */}
        {data.allowText && (
          <div style={{ marginBottom: 8 }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 10px',
              border: `1px solid ${theme.borderSecondary}`,
              borderRadius: theme.radius,
              background: theme.bgPrimary,
            }}>
              <Type size={10} color={theme.textMuted} />
              <input
                type="text"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onBlur={() => {
                  if (textInput && onEdit) {
                    onEdit({ blockType: 'question', field: 'submit', value: { responses: { ...selected, __text__: textInput } } })
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && textInput && onEdit) {
                    onEdit({ blockType: 'question', field: 'submit', value: { responses: { ...selected, __text__: textInput } } })
                  }
                }}
                placeholder={data.placeholder || 'Type your answer...'}
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  color: theme.textPrimary,
                  fontSize: '0.9em',
                  fontFamily: theme.fontSans,
                }}
              />
              {textInput && onEdit && (
                <button
                  type="button"
                  onClick={() => {
                    onEdit({ blockType: 'question', field: 'submit', value: { responses: { ...selected, __text__: textInput } }, blockId: data.text ?? data.title })
                  }}
                  style={{
                    padding: '2px 8px',
                    borderRadius: 4,
                    border: 'none',
                    background: theme.accent,
                    color: theme.textInverse,
                    fontSize: '0.75em',
                    fontWeight: 600,
                    cursor: 'pointer',
                    flexShrink: 0,
                  }}
                >
                  Save
                </button>
              )}
            </div>
          </div>
        )}

        {/* No submit button — selections auto-save via onEdit */}
      </div>
    )
  }

  // Interactive mode - Multi-question
  const questions = data.questions!
  const currentQ = questions[currentQuestion]
  const qId = currentQ.id || `q${currentQuestion}`
  const normalizedOptions = (currentQ.options || []).map(normalizeOption)
  const isMulti = currentQ.multi || false
  const selectedIds = isMulti
    ? ((selected[qId] || []) as string[])
    : (selected[qId] ? [selected[qId] as string] : [])

  const isLastQuestion = currentQuestion === questions.length - 1
  const canGoNext = selectedIds.length > 0 || isLastQuestion

  return (
    <div style={{
      borderLeft: `3px solid ${questionColor}`,
      padding: '8px 10px',
      background: theme.bgSecondary,
      borderRadius: theme.radius,
      fontFamily: theme.fontSans,
    }}>
      {/* Header with title */}
      {data.title && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <MessageSquare size={12} color={questionColor} style={{ flexShrink: 0 }} />
          <span style={{
            fontSize: '1em',
            color: theme.textPrimary,
            fontWeight: 600,
          }}>
            {data.title}
          </span>
        </div>
      )}

      {/* Progress dots */}
      <div style={{
        display: 'flex',
        gap: 4,
        marginBottom: 10,
        justifyContent: 'center',
      }}>
        {questions.map((_, idx) => {
          const isAnswered = !!selected[questions[idx].id || `q${idx}`]
          const isCurrent = idx === currentQuestion
          return (
            <div
              key={idx}
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: isCurrent
                  ? theme.accent
                  : isAnswered
                    ? `${theme.accent}66`
                    : theme.borderSecondary,
                transition: 'all 0.2s ease',
              }}
            />
          )
        })}
      </div>

      {/* Current question */}
      <div style={{
        fontSize: '0.95em',
        color: theme.textPrimary,
        fontWeight: 600,
        marginBottom: 8,
      }}>
        {currentQ.text}
      </div>

      {/* Options */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
        {normalizedOptions.map(opt => {
          const isSelected = selectedIds.includes(opt.id)
          const Icon = isMulti ? (isSelected ? CheckCircle2 : Circle) : (isSelected ? Check : Circle)

          return (
            <button
              key={opt.id}
              onClick={() => handleOptionClick(qId, opt.id, isMulti)}
              style={{
                padding: '8px 14px',
                borderRadius: 20,
                border: `1px solid ${isSelected ? theme.accent : theme.borderSecondary}`,
                background: isSelected ? theme.accent : theme.bgTertiary,
                color: isSelected ? theme.textInverse : theme.textPrimary,
                cursor: 'pointer',
                fontSize: '0.9em',
                fontFamily: theme.fontSans,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'all 0.15s ease',
                textAlign: 'left',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.background = theme.bgSecondary
                  e.currentTarget.style.borderColor = theme.accent
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  e.currentTarget.style.background = theme.bgTertiary
                  e.currentTarget.style.borderColor = theme.borderSecondary
                }
              }}
            >
              <Icon size={12} style={{ flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500 }} dangerouslySetInnerHTML={{ __html: simpleMarkdown(opt.label) }} />
                {opt.description && (
                  <div style={{
                    fontSize: '0.85em',
                    marginTop: 2,
                    opacity: 0.8,
                  }} dangerouslySetInnerHTML={{ __html: simpleMarkdown(opt.description) }} />
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Navigation buttons */}
      <div style={{ display: 'flex', gap: 6 }}>
        {currentQuestion > 0 && (
          <button
            onClick={() => setCurrentQuestion(currentQuestion - 1)}
            style={{
              flex: 1,
              padding: '6px 12px',
              borderRadius: theme.radius,
              border: `1px solid ${theme.borderSecondary}`,
              background: theme.bgTertiary,
              color: theme.textPrimary,
              cursor: 'pointer',
              fontSize: '0.9em',
              fontWeight: 600,
              fontFamily: theme.fontSans,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = theme.bgSecondary
              e.currentTarget.style.borderColor = theme.accent
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = theme.bgTertiary
              e.currentTarget.style.borderColor = theme.borderSecondary
            }}
          >
            <ChevronLeft size={12} />
            Back
          </button>
        )}

        <button
          onClick={() => {
            if (isLastQuestion) {
              handleSubmit()
            } else {
              setCurrentQuestion(currentQuestion + 1)
            }
          }}
          disabled={!canGoNext}
          style={{
            flex: 1,
            padding: '6px 12px',
            borderRadius: theme.radius,
            border: 'none',
            background: canGoNext ? theme.accent : theme.borderSecondary,
            color: theme.textInverse,
            cursor: canGoNext ? 'pointer' : 'not-allowed',
            fontSize: '0.9em',
            fontWeight: 600,
            fontFamily: theme.fontSans,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            transition: 'opacity 0.15s ease',
            opacity: canGoNext ? 1 : 0.5,
          }}
          onMouseEnter={(e) => {
            if (canGoNext) e.currentTarget.style.opacity = '0.85'
          }}
          onMouseLeave={(e) => {
            if (canGoNext) e.currentTarget.style.opacity = '1'
          }}
        >
          {isLastQuestion ? 'Submit' : 'Next'}
          {!isLastQuestion && <ChevronRight size={12} />}
        </button>
      </div>
    </div>
  )
})
