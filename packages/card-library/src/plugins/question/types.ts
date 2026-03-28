export type QuestionOption = {
  id: string
  label: string
  description?: string
}

export type Question = {
  id?: string
  text: string
  options?: (string | QuestionOption)[]
  multi?: boolean
}

export type QuestionBlockData = {
  // Single question form
  text?: string
  options?: (string | QuestionOption)[]
  multi?: boolean
  allowText?: boolean
  placeholder?: string
  // Multi-question form
  title?: string
  questions?: Question[]
  // State
  responses?: Record<string, unknown>
  response?: string  // Single saved answer (from inline save)
  submitted?: boolean
}
