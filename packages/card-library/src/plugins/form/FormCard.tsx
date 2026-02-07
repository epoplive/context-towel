import { memo, useState, useCallback } from 'react'
import {
  FileText, ChevronRight, ChevronLeft, Check,
  ToggleLeft, ToggleRight, Loader, AlertTriangle, ExternalLink, RefreshCw,
} from 'lucide-react'
import type { BlockRenderProps } from '../../blocks/types'
import type { FormBlockData, FormLastResult, ResultFieldMapping } from '../../blocks/form'

type FormField = NonNullable<FormBlockData['steps']>[number]['fields'][number]

/** Form card - renders interactive forms at different detail levels */
export const FormCard = memo(function FormCard({
  data,
  detail,
  theme,
  onEdit,
}: BlockRenderProps<FormBlockData>) {
  const [responses, setResponses] = useState<Record<string, unknown>>(data.responses || {})
  const [currentStep, setCurrentStep] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [focusedField, setFocusedField] = useState<string | null>(null)
  // AJAX results state
  const [apiLoading, setApiLoading] = useState(false)
  const [apiResult, setApiResult] = useState<FormLastResult | null>(data.lastResult || null)
  const [showApproval, setShowApproval] = useState(false)

  const steps = data.steps || []
  const mode = data.mode || 'single'
  const isMultiStep = mode === 'multi-step' && steps.length > 1

  if (detail === 'mini') {
    return (
      <div style={{
        borderLeft: `3px solid ${theme.accent}`,
        padding: '4px 8px',
        background: theme.bgSecondary,
        borderRadius: theme.radius,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontFamily: theme.fontSans,
      }}>
        <FileText size={10} color={theme.accent} style={{ flexShrink: 0 }} />
        <span style={{
          fontSize: 11,
          color: theme.textPrimary,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          flex: 1,
        }}>
          {data.title || 'Form'}
        </span>
      </div>
    )
  }

  // Count total fields across all steps
  const totalFields = steps.reduce((sum, step) => sum + step.fields.length, 0)
  const totalSteps = steps.length

  if (detail === 'summary') {
    return (
      <div style={{
        borderLeft: `3px solid ${theme.accent}`,
        padding: '6px 8px',
        background: theme.bgSecondary,
        borderRadius: theme.radius,
        fontFamily: theme.fontSans,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
          <FileText size={10} color={theme.accent} style={{ flexShrink: 0 }} />
          <span style={{
            fontSize: 11,
            color: theme.textPrimary,
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
          }}>
            {data.title || 'Form'}
          </span>
          <span style={{
            fontSize: 8,
            padding: '1px 5px',
            borderRadius: 3,
            background: `${theme.accent}22`,
            color: theme.accent,
          }}>
            {totalFields} field{totalFields !== 1 ? 's' : ''}
            {totalSteps > 1 && ` · ${totalSteps} step${totalSteps !== 1 ? 's' : ''}`}
          </span>
        </div>
        {data.description && (
          <div style={{
            fontSize: 9,
            color: theme.textSecondary,
            lineHeight: 1.4,
          }}>
            {data.description}
          </div>
        )}
      </div>
    )
  }

  // detail === 'full' - interactive form
  const activeStep = isMultiStep && steps[currentStep] ? steps[currentStep] : null
  const fieldsToShow = isMultiStep && activeStep
    ? activeStep.fields
    : steps.flatMap(s => s.fields)

  const validateStep = (): boolean => {
    const newErrors: Record<string, string> = {}
    const fields = isMultiStep && activeStep ? activeStep.fields : fieldsToShow

    for (const field of fields) {
      if (!shouldShowField(field)) continue

      if (field.required) {
        const value = responses[field.id]
        if (value === undefined || value === null || value === '') {
          newErrors[field.id] = 'This field is required'
        }
      }

      // Email validation
      if (field.type === 'email' && responses[field.id]) {
        const email = String(responses[field.id])
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          newErrors[field.id] = 'Invalid email address'
        }
      }

      // Number validation
      if (field.type === 'number' && responses[field.id]) {
        const num = Number(responses[field.id])
        if (isNaN(num)) {
          newErrors[field.id] = 'Must be a valid number'
        }
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (!validateStep()) return
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const hasApiAction = data.actions?.onSubmit?.target === 'api'
  const apiRequest = data.actions?.onSubmit?.request as Record<string, unknown> | undefined
  const approvalRequired = data.actions?.onSubmit?.approval?.required !== false

  const interpolateTemplate = useCallback((template: string, ctx: Record<string, unknown>): string => {
    return template.replace(/\$\{(\w+)\.(\w+)\}/g, (_match, ns, key) => {
      if (ns === 'responses') return String(ctx[key] ?? '')
      return _match // ${secrets.*} and ${params.*} resolved by host
    })
  }, [])

  const executeApiRequest = useCallback(async () => {
    if (!apiRequest) return
    setApiLoading(true)
    setApiResult(null)

    try {
      const url = interpolateTemplate(String(apiRequest.url || ''), responses)
      const method = String(apiRequest.method || 'POST').toUpperCase()
      const headers: Record<string, string> = {}
      if (apiRequest.headers && typeof apiRequest.headers === 'object') {
        for (const [k, v] of Object.entries(apiRequest.headers as Record<string, unknown>)) {
          headers[k] = interpolateTemplate(String(v), responses)
        }
      }
      let body: string | undefined
      if (apiRequest.body && typeof apiRequest.body === 'object') {
        const interpolated: Record<string, unknown> = {}
        for (const [k, v] of Object.entries(apiRequest.body as Record<string, unknown>)) {
          interpolated[k] = typeof v === 'string' ? interpolateTemplate(v, responses) : v
        }
        body = JSON.stringify(interpolated)
        if (!headers['Content-Type']) headers['Content-Type'] = 'application/json'
      }

      const resp = await fetch(url, { method, headers, body })
      const contentType = resp.headers.get('content-type') || ''
      const respData = contentType.includes('json') ? await resp.json() : await resp.text()

      const result: FormLastResult = {
        status: resp.status,
        data: respData,
        timestamp: new Date().toISOString(),
        error: resp.ok ? undefined : `HTTP ${resp.status}`,
      }
      setApiResult(result)

      // Persist last result via onEdit
      onEdit?.({
        blockType: 'form',
        field: 'lastResult',
        value: result,
      })
    } catch (err) {
      const result: FormLastResult = {
        status: 0,
        data: null,
        timestamp: new Date().toISOString(),
        error: err instanceof Error ? err.message : 'Request failed',
      }
      setApiResult(result)
    } finally {
      setApiLoading(false)
    }
  }, [apiRequest, responses, interpolateTemplate, onEdit])

  const handleSubmit = () => {
    if (!validateStep()) return

    setSubmitted(true)

    if (hasApiAction && apiRequest) {
      if (approvalRequired) {
        setShowApproval(true)
      } else {
        executeApiRequest()
      }
    }

    onEdit?.({
      blockType: 'form',
      field: 'submit',
      value: {
        id: data.id,
        title: data.title,
        responses,
      },
    })
  }

  const handleApprove = () => {
    setShowApproval(false)
    executeApiRequest()
  }

  const handleDeny = () => {
    setShowApproval(false)
  }

  const shouldShowField = (field: FormField): boolean => {
    if (!field.when) return true
    const conditionValue = responses[field.when.field]
    if (field.when.is !== undefined) {
      return conditionValue === field.when.is
    }
    if (field.when.in !== undefined) {
      return field.when.in.includes(conditionValue as any)
    }
    return true
  }

  const updateResponse = (fieldId: string, value: unknown) => {
    setResponses({ ...responses, [fieldId]: value })
    // Clear error for this field
    if (errors[fieldId]) {
      const newErrors = { ...errors }
      delete newErrors[fieldId]
      setErrors(newErrors)
    }
  }

  if (submitted) {
    const resultDisplay = data.results?.display || 'below'
    const isSide = resultDisplay === 'side'
    const isInline = resultDisplay === 'inline'

    // Approval dialog
    if (showApproval && apiRequest) {
      const previewUrl = interpolateTemplate(String(apiRequest.url || ''), responses)
      const previewMethod = String(apiRequest.method || 'POST').toUpperCase()
      return (
        <div style={{
          borderLeft: `3px solid ${theme.warning}`,
          padding: '8px 10px',
          background: theme.bgSecondary,
          borderRadius: theme.radius,
          fontFamily: theme.fontSans,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <AlertTriangle size={14} color={theme.warning} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: theme.textPrimary, fontWeight: 600 }}>
              Approve API Request
            </span>
          </div>
          <div style={{ fontSize: 10, color: theme.textSecondary, marginBottom: 8 }}>
            <div style={{ marginBottom: 4 }}>
              <span style={{ fontWeight: 600 }}>{previewMethod}</span> {previewUrl}
            </div>
            {apiRequest.body ? (
              <pre style={{
                fontSize: 9, background: theme.bgTertiary, padding: 6,
                borderRadius: theme.radius, overflow: 'auto', maxHeight: 100,
                color: theme.textSecondary, margin: 0,
              }}>
                {JSON.stringify(apiRequest.body, null, 2) ?? ''}
              </pre>
            ) : null}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={handleApprove} style={{
              padding: '6px 12px', borderRadius: theme.radius, border: 'none',
              background: theme.success, color: theme.textInverse,
              fontSize: 11, fontFamily: theme.fontSans, cursor: 'pointer',
            }}>Approve</button>
            <button onClick={handleDeny} style={{
              padding: '6px 12px', borderRadius: theme.radius,
              border: `1px solid ${theme.borderSecondary}`,
              background: theme.bgTertiary, color: theme.textPrimary,
              fontSize: 11, fontFamily: theme.fontSans, cursor: 'pointer',
            }}>Deny</button>
          </div>
        </div>
      )
    }

    // Read-only summary + results panel
    const responseSummary = (
      <div style={{ fontSize: 10, color: theme.textSecondary }}>
        {Object.entries(responses).map(([fieldId, value]) => {
          const field = steps.flatMap(s => s.fields).find(f => f.id === fieldId)
          if (!field) return null
          return (
            <div key={fieldId} style={{ marginBottom: 6 }}>
              <div style={{ fontSize: 9, color: theme.textMuted, marginBottom: 2 }}>
                {field.label || fieldId}
              </div>
              <div style={{ fontSize: 10, color: theme.textPrimary }}>
                {formatValue(value, field.type)}
              </div>
            </div>
          )
        })}
      </div>
    )

    const resultsPanel = hasApiAction ? (
      <ResultsPanel
        loading={apiLoading}
        result={apiResult}
        format={data.results?.format || 'table'}
        mapping={data.results?.mapping}
        successMessage={data.results?.onSuccess}
        errorMessage={data.results?.onError}
        theme={theme}
        onRetry={executeApiRequest}
      />
    ) : null

    // Inline mode: show only results, hide form summary
    if (isInline && resultsPanel && apiResult) {
      return (
        <div style={{
          borderLeft: `3px solid ${apiResult.error ? theme.error : theme.success}`,
          padding: '8px 10px', background: theme.bgSecondary,
          borderRadius: theme.radius, fontFamily: theme.fontSans,
        }}>
          {resultsPanel}
        </div>
      )
    }

    return (
      <div style={{
        borderLeft: `3px solid ${theme.success}`,
        padding: '8px 10px',
        background: theme.bgSecondary,
        borderRadius: theme.radius,
        fontFamily: theme.fontSans,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <Check size={14} color={theme.success} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 12, color: theme.textPrimary, fontWeight: 600 }}>
            {data.title || 'Form'} - Submitted
          </span>
        </div>

        <div style={{
          display: isSide ? 'flex' : 'block',
          gap: isSide ? 12 : 0,
        }}>
          <div style={{ flex: isSide ? 1 : undefined }}>
            {responseSummary}
          </div>
          {resultsPanel && (
            <div style={{
              flex: isSide ? 1 : undefined,
              marginTop: isSide ? 0 : 10,
              borderTop: isSide ? 'none' : `1px solid ${theme.borderSecondary}`,
              paddingTop: isSide ? 0 : 10,
            }}>
              {resultsPanel}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{
      borderLeft: `3px solid ${theme.accent}`,
      padding: '8px 10px',
      background: theme.bgSecondary,
      borderRadius: theme.radius,
      fontFamily: theme.fontSans,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <FileText size={12} color={theme.accent} style={{ flexShrink: 0 }} />
        <span style={{
          fontSize: 12,
          color: theme.textPrimary,
          fontWeight: 600,
          flex: 1,
        }}>
          {data.title || 'Form'}
        </span>
      </div>

      {/* Description */}
      {data.description && (
        <div style={{
          fontSize: 10,
          color: theme.textSecondary,
          marginBottom: 8,
          lineHeight: 1.4,
        }}>
          {data.description}
        </div>
      )}

      {/* Multi-step progress */}
      {isMultiStep && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {steps.map((_, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                <div style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: idx === currentStep ? theme.accent : idx < currentStep ? theme.success : theme.borderSecondary,
                  flexShrink: 0,
                }} />
                {idx < steps.length - 1 && (
                  <div style={{
                    flex: 1,
                    height: 2,
                    background: idx < currentStep ? theme.success : theme.borderSecondary,
                    marginLeft: 2,
                  }} />
                )}
              </div>
            ))}
          </div>
          {activeStep?.title && (
            <div style={{
              fontSize: 10,
              color: theme.textPrimary,
              fontWeight: 600,
              marginTop: 6,
            }}>
              {activeStep.title}
            </div>
          )}
          {activeStep?.description && (
            <div style={{
              fontSize: 9,
              color: theme.textSecondary,
              marginTop: 2,
            }}>
              {activeStep.description}
            </div>
          )}
        </div>
      )}

      {/* Fields */}
      <div style={{ marginBottom: 10 }}>
        {fieldsToShow.map((field) => {
          if (!shouldShowField(field)) return null

          return (
            <div key={field.id} style={{ marginBottom: 10 }}>
              {/* Label */}
              {field.label && (
                <div style={{
                  fontSize: 10,
                  color: theme.textPrimary,
                  marginBottom: 4,
                  fontWeight: 500,
                }}>
                  {field.label}
                  {field.required && (
                    <span style={{ color: theme.error, marginLeft: 2 }}>*</span>
                  )}
                </div>
              )}

              {/* Field input */}
              <FieldInput
                field={field}
                value={responses[field.id]}
                onChange={(val) => updateResponse(field.id, val)}
                theme={theme}
                isFocused={focusedField === field.id}
                onFocus={() => setFocusedField(field.id)}
                onBlur={() => setFocusedField(null)}
              />

              {/* Error message */}
              {errors[field.id] && (
                <div style={{
                  fontSize: 9,
                  color: theme.error,
                  marginTop: 2,
                }}>
                  {errors[field.id]}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Navigation buttons */}
      <div style={{
        display: 'flex',
        gap: 6,
        justifyContent: isMultiStep ? 'space-between' : 'flex-end',
      }}>
        {isMultiStep && currentStep > 0 && (
          <button
            onClick={handleBack}
            style={{
              padding: '6px 10px',
              borderRadius: theme.radius,
              border: `1px solid ${theme.borderSecondary}`,
              background: theme.bgTertiary,
              color: theme.textPrimary,
              fontSize: 11,
              fontFamily: theme.fontSans,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <ChevronLeft size={12} />
            Back
          </button>
        )}

        {isMultiStep && currentStep < steps.length - 1 ? (
          <button
            onClick={handleNext}
            style={{
              padding: '6px 10px',
              borderRadius: theme.radius,
              border: 'none',
              background: theme.accent,
              color: theme.textInverse,
              fontSize: 11,
              fontFamily: theme.fontSans,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              marginLeft: 'auto',
            }}
          >
            Next
            <ChevronRight size={12} />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            style={{
              padding: '6px 10px',
              borderRadius: theme.radius,
              border: 'none',
              background: theme.accent,
              color: theme.textInverse,
              fontSize: 11,
              fontFamily: theme.fontSans,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              marginLeft: isMultiStep ? 'auto' : 0,
            }}
          >
            <Check size={12} />
            Submit
          </button>
        )}
      </div>
    </div>
  )
})

// --- Results panel component ---

function ResultsPanel({
  loading,
  result,
  format,
  mapping,
  successMessage,
  errorMessage,
  theme,
  onRetry,
}: {
  loading: boolean
  result: FormLastResult | null
  format: 'json' | 'table' | 'card'
  mapping?: ResultFieldMapping[]
  successMessage?: string
  errorMessage?: string
  theme: any
  onRetry: () => void
}) {
  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0',
      }}>
        <Loader size={14} color={theme.accent} style={{ animation: 'spin 1s linear infinite' }} />
        <span style={{ fontSize: 10, color: theme.textSecondary }}>Sending request...</span>
        <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
      </div>
    )
  }

  if (!result) return null

  if (result.error) {
    return (
      <div style={{
        padding: '8px 0',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <AlertTriangle size={12} color={theme.error} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 10, color: theme.error, fontWeight: 600 }}>
            {errorMessage || result.error}
          </span>
        </div>
        <button
          onClick={onRetry}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '4px 8px', borderRadius: theme.radius,
            border: `1px solid ${theme.borderSecondary}`,
            background: theme.bgTertiary, color: theme.textPrimary,
            fontSize: 10, fontFamily: theme.fontSans, cursor: 'pointer',
          }}
        >
          <RefreshCw size={10} />
          Retry
        </button>
      </div>
    )
  }

  // Success
  const data = result.data

  if (successMessage) {
    return (
      <div style={{ padding: '8px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
          <Check size={12} color={theme.success} style={{ flexShrink: 0 }} />
          <span style={{ fontSize: 10, color: theme.success, fontWeight: 600 }}>
            {successMessage}
          </span>
        </div>
        {renderResultData(data, format, mapping, theme)}
      </div>
    )
  }

  return (
    <div style={{ padding: '8px 0' }}>
      {renderResultData(data, format, mapping, theme)}
    </div>
  )
}

function renderResultData(
  data: unknown,
  format: 'json' | 'table' | 'card',
  mapping: ResultFieldMapping[] | undefined,
  theme: any,
) {
  if (data === null || data === undefined) return null

  // JSON format
  if (format === 'json') {
    return (
      <pre style={{
        fontSize: 9, background: theme.bgTertiary, padding: 8,
        borderRadius: theme.radius, overflow: 'auto', maxHeight: 200,
        color: theme.textSecondary, margin: 0, whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}>
        {typeof data === 'string' ? data : JSON.stringify(data, null, 2)}
      </pre>
    )
  }

  // Table / Card format with mapping
  if (mapping && mapping.length > 0 && typeof data === 'object' && data !== null) {
    const record = data as Record<string, unknown>
    const rows = mapping.map(m => ({
      label: m.label,
      value: getNestedValue(record, m.field),
      type: m.type || 'text',
    }))

    if (format === 'card') {
      return (
        <div style={{
          border: `1px solid ${theme.borderSecondary}`,
          borderRadius: theme.radius, overflow: 'hidden',
        }}>
          {rows.map((row, i) => (
            <div key={i} style={{
              padding: '6px 10px',
              borderBottom: i < rows.length - 1 ? `1px solid ${theme.borderSecondary}` : 'none',
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <span style={{ fontSize: 9, color: theme.textMuted, minWidth: 60 }}>{row.label}</span>
              {renderFieldValue(row.value, row.type, theme)}
            </div>
          ))}
        </div>
      )
    }

    // Table format (default)
    return (
      <table style={{
        width: '100%', borderCollapse: 'collapse', fontSize: 10,
      }}>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{
              borderBottom: `1px solid ${theme.borderSecondary}`,
            }}>
              <td style={{
                padding: '4px 8px 4px 0', color: theme.textMuted,
                fontSize: 9, fontWeight: 600, whiteSpace: 'nowrap',
              }}>
                {row.label}
              </td>
              <td style={{ padding: '4px 0', color: theme.textPrimary }}>
                {renderFieldValue(row.value, row.type, theme)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    )
  }

  // Fallback: render as JSON
  return (
    <pre style={{
      fontSize: 9, background: theme.bgTertiary, padding: 8,
      borderRadius: theme.radius, overflow: 'auto', maxHeight: 200,
      color: theme.textSecondary, margin: 0, whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
    }}>
      {typeof data === 'string' ? data : JSON.stringify(data, null, 2)}
    </pre>
  )
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((curr, key) => {
    if (curr && typeof curr === 'object' && !Array.isArray(curr)) {
      return (curr as Record<string, unknown>)[key]
    }
    return undefined
  }, obj)
}

function renderFieldValue(value: unknown, type: string, theme: any) {
  if (value === null || value === undefined) {
    return <span style={{ color: theme.textMuted }}>—</span>
  }

  const str = String(value)

  if (type === 'link') {
    return (
      <a href={str} target="_blank" rel="noopener noreferrer" style={{
        color: theme.accent, fontSize: 10, display: 'inline-flex',
        alignItems: 'center', gap: 3, textDecoration: 'none',
      }}>
        {str}
        <ExternalLink size={9} />
      </a>
    )
  }

  if (type === 'badge') {
    return (
      <span style={{
        fontSize: 9, padding: '1px 6px', borderRadius: 10,
        background: `${theme.accent}22`, color: theme.accent,
      }}>
        {str}
      </span>
    )
  }

  if (type === 'code') {
    return (
      <code style={{
        fontSize: 9, padding: '1px 4px', borderRadius: 3,
        background: theme.bgTertiary, color: theme.textSecondary,
        fontFamily: theme.fontMono,
      }}>
        {str}
      </code>
    )
  }

  if (type === 'image') {
    return (
      <img src={str} alt="" style={{
        maxWidth: 200, maxHeight: 100, borderRadius: theme.radius,
      }} />
    )
  }

  // text (default)
  return <span style={{ fontSize: 10, color: theme.textPrimary }}>{str}</span>
}

// --- Field input component ---

function FieldInput({
  field,
  value,
  onChange,
  theme,
  isFocused,
  onFocus,
  onBlur,
}: {
  field: FormField
  value: unknown
  onChange: (val: unknown) => void
  theme: any
  isFocused: boolean
  onFocus: () => void
  onBlur: () => void
}) {
  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '6px 10px',
    border: `1px solid ${isFocused ? theme.accent : theme.borderSecondary}`,
    borderRadius: theme.radius,
    background: theme.bgTertiary,
    color: theme.textPrimary,
    fontSize: 11,
    fontFamily: theme.fontSans,
    outline: 'none',
  }

  const type = field.type

  if (type === 'text' || type === 'email' || type === 'tel' || type === 'number') {
    return (
      <input
        type={type}
        value={value as string || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        style={inputStyle}
        onFocus={onFocus}
        onBlur={onBlur}
      />
    )
  }

  if (type === 'textarea') {
    return (
      <textarea
        value={value as string || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={field.placeholder}
        rows={3}
        style={inputStyle}
        onFocus={onFocus}
        onBlur={onBlur}
      />
    )
  }

  if (type === 'date') {
    return (
      <input
        type="date"
        value={value as string || ''}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
        onFocus={onFocus}
        onBlur={onBlur}
      />
    )
  }

  if (type === 'checkbox') {
    const isChecked = Boolean(value)
    return (
      <button
        onClick={() => onChange(!isChecked)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: 4,
        }}
      >
        {isChecked ? (
          <ToggleRight size={20} color={theme.accent} />
        ) : (
          <ToggleLeft size={20} color={theme.textMuted} />
        )}
        <span style={{ fontSize: 10, color: theme.textPrimary }}>
          {isChecked ? 'On' : 'Off'}
        </span>
      </button>
    )
  }

  if (type === 'select' && field.options) {
    const options = field.options
    if (options.length <= 4) {
      // Button group
      return (
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {options.map((opt) => {
            const isSelected = value === opt.id
            return (
              <button
                key={opt.id}
                onClick={() => onChange(opt.id)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 14,
                  border: `1px solid ${isSelected ? theme.accent : theme.borderSecondary}`,
                  background: isSelected ? `${theme.accent}22` : theme.bgTertiary,
                  color: isSelected ? theme.accent : theme.textPrimary,
                  fontSize: 10,
                  fontFamily: theme.fontSans,
                  cursor: 'pointer',
                }}
              >
                {opt.label}
              </button>
            )
          })}
        </div>
      )
    } else {
      // Dropdown
      return (
        <select
          value={value as string || ''}
          onChange={(e) => onChange(e.target.value)}
          style={inputStyle}
          onFocus={onFocus}
          onBlur={onBlur}
        >
          <option value="">Select...</option>
          {options.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      )
    }
  }

  if (type === 'multiselect' && field.options) {
    const selectedValues = Array.isArray(value) ? value : []
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {field.options.map((opt) => {
          const isSelected = selectedValues.includes(opt.id)
          return (
            <button
              key={opt.id}
              onClick={() => {
                const newValues = isSelected
                  ? selectedValues.filter(v => v !== opt.id)
                  : [...selectedValues, opt.id]
                onChange(newValues)
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '4px 8px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <div style={{
                width: 14,
                height: 14,
                border: `1px solid ${isSelected ? theme.accent : theme.borderSecondary}`,
                borderRadius: 3,
                background: isSelected ? theme.accent : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {isSelected && <Check size={10} color={theme.textInverse} />}
              </div>
              <span style={{ fontSize: 10, color: theme.textPrimary }}>
                {opt.label}
              </span>
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div style={{ fontSize: 9, color: theme.textMuted }}>
      Unsupported field type: {type}
    </div>
  )
}

// --- Helpers ---

function formatValue(value: unknown, _type: string): string {
  if (value === null || value === undefined) return '—'
  if (Array.isArray(value)) return value.join(', ')
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}
