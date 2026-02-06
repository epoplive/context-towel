// Project identity helpers — copied from LG (no external deps)

export type ProjectId = string
export type ProjectPath = string

const normalizeValue = (value?: string | null): string | null => {
  if (!value) return null
  const normalized = value.replace(/\\/g, '/').replace(/\/+$/, '')
  return normalized.length > 0 ? normalized : null
}

export const normalizeProjectPath = (value?: string | null): ProjectPath | null => {
  const normalized = normalizeValue(value)
  return normalized ? (normalized as ProjectPath) : null
}

export const projectIdFromPath = (value?: string | null): ProjectId | null => {
  const normalized = normalizeProjectPath(value)
  return normalized ? (normalized as ProjectId) : null
}

export const projectKey = (value?: string | null, fallback = 'default'): string => {
  return normalizeProjectPath(value) ?? fallback
}

export const isSameProject = (a?: string | null, b?: string | null): boolean => {
  return normalizeProjectPath(a) === normalizeProjectPath(b)
}
