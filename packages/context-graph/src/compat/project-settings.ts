// ============================================================================
// Project Settings - Types and helpers
// ============================================================================

export interface ProjectSettingsStack {
  languages: string[]
  frameworks: string[]
  orms: string[]
  databases: string[]
}

export interface ProjectServer {
  name: string
  url: string
  environment?: string
}

export interface ProjectCommand {
  name: string
  command: string
}

export interface ProjectSettings {
  stack: ProjectSettingsStack
  servers: ProjectServer[]
  commands: ProjectCommand[]
  folders: {
    working: string
    docs: string
    archive: string
  }
}

export const PROJECT_SETTINGS_START_MARKER = '<!-- LOOKING_GLASS_PROJECT_SETTINGS_START -->'
export const PROJECT_SETTINGS_END_MARKER = '<!-- LOOKING_GLASS_PROJECT_SETTINGS_END -->'

const DEFAULT_FOLDERS: ProjectSettings['folders'] = {
  working: '.context/working',
  docs: '.context/docs',
  archive: '.context/archive',
}

const DEFAULT_STACK: ProjectSettingsStack = {
  languages: [],
  frameworks: [],
  orms: [],
  databases: [],
}

export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  stack: DEFAULT_STACK,
  servers: [],
  commands: [],
  folders: DEFAULT_FOLDERS,
}

interface LegacyProjectSettings {
  languages?: string[]
  frameworks?: string[]
  orms?: string[]
  databases?: string[]
  urls?: {
    dev?: string
    staging?: string
    prod?: string
  }
  commands?: {
    dev?: string
    start?: string
    stop?: string
    restart?: string
    build?: string
    test?: string
  } | ProjectCommand[]
  folders?: ProjectSettings['folders']
  stack?: ProjectSettingsStack
  servers?: ProjectServer[]
}

function normalizePathInput(value: string): string {
  const cleaned = value.replace(/\\/g, '/').trim()
  if (!cleaned) return ''
  return cleaned
    .replace(/\/{2,}/g, '/')
    .replace(/\/+$/, '')
}

function normalizeFolderPath(value: string): string {
  let cleaned = normalizePathInput(value)
  if (!cleaned) return ''
  if (cleaned === '.') return '.'
  if (cleaned.startsWith('./')) {
    cleaned = cleaned.replace(/^\.\/+/, '')
  }
  return cleaned
}

function normalizeFolderSegments(value: string): string[] {
  const cleaned = normalizePathInput(value)
  if (!cleaned) return []
  return cleaned
    .split('/')
    .filter(Boolean)
    .map(segment => {
      if (segment === '.') return ''
      if (segment === '..') return 'up'
      return segment.replace(/:/g, '')
    })
    .filter(Boolean)
}

function buildPathId(prefix: string, value: string): string {
  const segments = normalizeFolderSegments(value)
  if (segments.length === 0) return prefix
  return `${prefix}/${segments.join('/')}`
}

function getExternalFolderId(value: string): string {
  let cleaned = normalizePathInput(value)
  if (!cleaned) return 'external'
  if (cleaned.startsWith('~')) {
    cleaned = cleaned.replace(/^~\/?/, '')
    return buildPathId('home', cleaned)
  }
  cleaned = cleaned.replace(/^\/+/, '')
  return buildPathId('external', cleaned)
}

function getProjectFolderId(value: string): string {
  let cleaned = normalizePathInput(value)
  if (!cleaned) return 'project'
  cleaned = cleaned.replace(/^\.\/+/, '')
  cleaned = cleaned.replace(/^\/+/, '')
  return buildPathId('project', cleaned)
}

function normalizeStringList(values?: string[]): string[] {
  if (!values) return []
  const seen = new Set<string>()
  const normalized: string[] = []
  values.forEach(value => {
    const cleaned = value.trim()
    if (cleaned && !seen.has(cleaned)) {
      seen.add(cleaned)
      normalized.push(cleaned)
    }
  })
  return normalized
}

function normalizeServers(values?: ProjectServer[]): ProjectServer[] {
  if (!values) return []
  return values
    .map(server => ({
      name: server.name?.trim() || '',
      url: server.url?.trim() || '',
      environment: server.environment?.trim() || undefined,
    }))
    .filter(server => server.name || server.url)
}

function normalizeCommands(values?: ProjectCommand[]): ProjectCommand[] {
  if (!values) return []
  return values
    .map(command => ({
      name: command.name?.trim() || '',
      command: command.command?.trim() || '',
    }))
    .filter(command => command.name || command.command)
}

function normalizeLegacyCommands(values?: LegacyProjectSettings['commands']): ProjectCommand[] {
  if (!values) return []
  if (Array.isArray(values)) {
    return normalizeCommands(values)
  }
  return Object.entries(values)
    .map(([name, command]) => ({
      name: name.trim(),
      command: (command || '').trim(),
    }))
    .filter(entry => entry.command)
}

function normalizeLegacyServers(values?: LegacyProjectSettings['urls']): ProjectServer[] {
  if (!values) return []
  const servers: ProjectServer[] = []
  if (values.dev?.trim()) servers.push({ name: 'dev', url: values.dev.trim() })
  if (values.staging?.trim()) servers.push({ name: 'staging', url: values.staging.trim() })
  if (values.prod?.trim()) servers.push({ name: 'prod', url: values.prod.trim() })
  return servers
}

function normalizeStack(input?: LegacyProjectSettings): ProjectSettingsStack {
  if (input?.stack) {
    return {
      languages: normalizeStringList(input.stack.languages),
      frameworks: normalizeStringList(input.stack.frameworks),
      orms: normalizeStringList(input.stack.orms),
      databases: normalizeStringList(input.stack.databases),
    }
  }

  return {
    languages: normalizeStringList(input?.languages),
    frameworks: normalizeStringList(input?.frameworks),
    orms: normalizeStringList(input?.orms),
    databases: normalizeStringList(input?.databases),
  }
}

export function normalizeProjectSettings(input?: Partial<ProjectSettings> & LegacyProjectSettings): ProjectSettings {
  const folders: ProjectSettings['folders'] = {
    ...DEFAULT_FOLDERS,
    ...(input?.folders || {}),
  }

  const normalizedFolders = {
    working: normalizeFolderPath(folders.working),
    docs: normalizeFolderPath(folders.docs),
    archive: normalizeFolderPath(folders.archive),
  }
  ;(Object.keys(normalizedFolders) as Array<keyof ProjectSettings['folders']>).forEach((key) => {
    if (!normalizedFolders[key]) {
      normalizedFolders[key] = DEFAULT_FOLDERS[key]
    }
  })

  const servers = normalizeServers(input?.servers)
  const legacyServers = normalizeLegacyServers(input?.urls)
  const hasServers = Object.prototype.hasOwnProperty.call(input ?? {}, 'servers')
  const resolvedServers = hasServers ? servers : (servers.length > 0 ? servers : legacyServers)

  const hasCommandArray = Array.isArray(input?.commands)
  const commands = normalizeCommands(hasCommandArray ? (input?.commands as ProjectCommand[]) : [])
  const legacyCommands = normalizeLegacyCommands(input?.commands)
  const resolvedCommands = hasCommandArray ? commands : (commands.length > 0 ? commands : legacyCommands)

  return {
    stack: normalizeStack(input),
    servers: resolvedServers,
    commands: resolvedCommands,
    folders: normalizedFolders,
  }
}

export function getProjectSettingsPath(projectPath: string): string {
  return `${projectPath}/.context/project-settings.json`
}

function isAbsolutePath(path: string): boolean {
  return path.startsWith('/') || path.startsWith('~')
}

function isExplicitProjectPath(path: string): boolean {
  return path === '.' || path.startsWith('./') || path.startsWith('../')
}

export function getContextFolderPath(projectPath: string, folder: string): string {
  const normalized = normalizeFolderPath(folder)
  if (!normalized) return projectPath
  if (normalized === '.') return projectPath
  if (isAbsolutePath(normalized)) return normalized
  if (isExplicitProjectPath(normalized)) return `${projectPath}/${normalized.replace(/^\/+/, '')}`
  return `${projectPath}/${normalized.replace(/^\/+/, '')}`
}

export function getWorkspaceFolderId(folder: string): string {
  const normalized = normalizeFolderPath(folder)
  if (!normalized) return 'project'
  if (isAbsolutePath(normalized)) {
    return getExternalFolderId(normalized)
  }
  return getProjectFolderId(normalized)
}

export function getContextFolderId(folder: string): string {
  return getWorkspaceFolderId(folder)
}

export function matchesFolderId(id: string, folder: string): boolean {
  const folderId = getWorkspaceFolderId(folder)
  return id === folderId || id.startsWith(`${folderId}/`)
}

export function formatFolderLabel(folder: string): string {
  const normalized = normalizeFolderPath(folder)
  if (!normalized) return 'Folder'
  if (normalized === '.') return 'Project Root'
  const trimmed = normalized.replace(/\/+$/, '')
  if (trimmed.startsWith('/') || trimmed.startsWith('~')) {
    const parts = trimmed.split('/').filter(Boolean)
    const last = parts[parts.length - 1]
    if (!last) return 'Folder'
    return last
      .split(/[\\/_-]+/)
      .filter(Boolean)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
  }

  const cleaned = trimmed
    .replace(/^\.context\/?/, '')
    .replace(/^\.\/+/, '')
    .replace(/^\.\.\/+/, '')
    .replace(/^\/+/, '')
  if (!cleaned) return 'Folder'
  return cleaned
    .split(/[\/_-]+/)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatList(values: string[]): string {
  return values.length > 0 ? values.join(', ') : 'None'
}

function formatServerList(servers: ProjectServer[]): string[] {
  if (servers.length === 0) return ['- None']
  return servers.map(server => {
    const label = server.environment ? `${server.name} (${server.environment})` : server.name
    const name = label || 'Server'
    return `- ${name}: ${server.url || 'None'}`
  })
}

function formatCommandList(commands: ProjectCommand[]): string[] {
  if (commands.length === 0) return ['- None']
  return commands.map(command => `- ${command.name || 'Command'}: \`${command.command || ''}\``)
}

function formatFolderValue(value: string): string {
  if (value === '.') return 'Project root'
  return value || 'Default'
}

export function formatProjectSettingsMarkdown(settings: ProjectSettings): string {
  const lines: string[] = ['## Project Settings', '']

  lines.push('### Stack')
  lines.push(`- Languages: ${formatList(settings.stack.languages)}`)
  lines.push(`- Frameworks: ${formatList(settings.stack.frameworks)}`)
  lines.push(`- ORMs: ${formatList(settings.stack.orms)}`)
  lines.push(`- Databases: ${formatList(settings.stack.databases)}`)
  lines.push('')

  lines.push('### Servers')
  lines.push(...formatServerList(settings.servers))
  lines.push('')

  lines.push('### Commands')
  lines.push(...formatCommandList(settings.commands))
  lines.push('')

  lines.push('### Folder Overrides')
  lines.push(`- Working: \`${formatFolderValue(settings.folders.working)}\``)
  lines.push(`- Docs: \`${formatFolderValue(settings.folders.docs)}\``)
  lines.push(`- Archive: \`${formatFolderValue(settings.folders.archive)}\``)

  return lines.join('\n')
}

export function upsertManagedSection(content: string, section: string): string {
  const startIdx = content.indexOf(PROJECT_SETTINGS_START_MARKER)
  const endIdx = content.indexOf(PROJECT_SETTINGS_END_MARKER)
  const wrapped = `${PROJECT_SETTINGS_START_MARKER}\n${section}\n${PROJECT_SETTINGS_END_MARKER}`

  if (startIdx === -1 || endIdx === -1) {
    return `${content.trimEnd()}\n\n${wrapped}\n`
  }

  return content.slice(0, startIdx) + wrapped + content.slice(endIdx + PROJECT_SETTINGS_END_MARKER.length)
}

export function upsertProjectSettings(content: string, settings: ProjectSettings): string {
  return upsertManagedSection(content, formatProjectSettingsMarkdown(settings))
}
