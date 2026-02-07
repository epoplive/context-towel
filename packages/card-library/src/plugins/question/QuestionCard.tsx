import { memo, useState } from 'react'
import {
  MessageSquare, ChevronRight, ChevronLeft, Check, Circle, CheckCircle2, Type,
} from 'lucide-react'
import type { BlockRenderProps } from '../../blocks/types'
import type { QuestionBlockData, QuestionOption } from './types'

/** Question card — renders interactive option picker at different detail levels */
export const QuestionCard = memo(function QuestionCard({
  data,
  detail,
  theme,
  onEdit,
}: BlockRenderProps<QuestionBlockData>) {
  const [selected, setSelected] = useState<Record<string, string | string[]>>({})
  const [currentQuestion, setCurrentQuestion] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [textInput, setTextInput] = useState('')

  const isSubmitted = data.submitted === true || submitted
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
          fontSize: 11,
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
            fontSize: 11,
            color: theme.textPrimary,
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}>
            {displayText}
          </span>
          {optionCount > 0 && (
            <span style={{
              fontSize: 7,
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
    onEdit?.({ blockType: 'question', field: 'submit', value: { responses } })
    setSubmitted(true)
  }

  const handleOptionClick = (questionId: string, optionId: string, isMulti: boolean) => {
    if (isSubmitted) return

    setSelected(prev => {
      if (isMulti) {
        const current = (prev[questionId] || []) as string[]
        const isSelected = current.includes(optionId)
        return {
          ...prev,
          [questionId]: isSelected
            ? current.filter(id => id !== optionId)
            : [...current, optionId],
        }
      } else {
        return { ...prev, [questionId]: optionId }
      }
    })
  }

  // Read-only view after submission
  if (isSubmitted) {
    const displayResponses = data.responses || selected

    return (
      <div style={{
        borderLeft: `3px solid ${questionColor}`,
        padding: '8px 10px',
        background: theme.bgSecondary,
        borderRadius: theme.radius,
        fontFamily: theme.fontSans,
        opacity: 0.8,
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <MessageSquare size={12} color={questionColor} style={{ flexShrink: 0 }} />
          <span style={{
            fontSize: 12,
            color: theme.textPrimary,
            fontWeight: 600,
            flex: 1,
          }}>
            {data.title || data.text || 'Question'}
          </span>
          <span style={{
            fontSize: 7,
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
        </div>

        {/* Show responses */}
        {isMultiQuestion ? (
          data.questions!.map((q, idx) => {
            const qId = q.id || `q${idx}`
            const response = displayResponses[qId]
            return (
              <div key={qId} style={{ marginBottom: 6 }}>
                <div style={{
                  fontSize: 10,
                  color: theme.textPrimary,
                  marginBottom: 2,
                  fontWeight: 500,
                }}>
                  {q.text}
                </div>
                <div style={{
                  fontSize: 9,
                  color: theme.textSecondary,
                  paddingLeft: 8,
                }}>
                  {Array.isArray(response)
                    ? response.join(', ')
                    : String(response || 'No answer')}
                </div>
              </div>
            )
          })
        ) : (
          <div style={{
            fontSize: 10,
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
            fontSize: 12,
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
                  fontSize: 10,
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
                  <div style={{ fontWeight: 500 }}>{opt.label}</div>
                  {opt.description && (
                    <div style={{
                      fontSize: 9,
                      marginTop: 2,
                      opacity: 0.8,
                    }}>
                      {opt.description}
                    </div>
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
                placeholder={data.placeholder || 'Type your answer...'}
                style={{
                  flex: 1,
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  color: theme.textPrimary,
                  fontSize: 10,
                  fontFamily: theme.fontSans,
                }}
              />
            </div>
          </div>
        )}

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          style={{
            width: '100%',
            padding: '6px 12px',
            borderRadius: theme.radius,
            border: 'none',
            background: theme.accent,
            color: theme.textInverse,
            cursor: 'pointer',
            fontSize: 10,
            fontWeight: 600,
            fontFamily: theme.fontSans,
            transition: 'opacity 0.15s ease',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85' }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
        >
          Submit
        </button>
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
            fontSize: 12,
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
        fontSize: 11,
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
                fontSize: 10,
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
                <div style={{ fontWeight: 500 }}>{opt.label}</div>
                {opt.description && (
                  <div style={{
                    fontSize: 9,
                    marginTop: 2,
                    opacity: 0.8,
                  }}>
                    {opt.description}
                  </div>
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
              fontSize: 10,
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
            fontSize: 10,
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
