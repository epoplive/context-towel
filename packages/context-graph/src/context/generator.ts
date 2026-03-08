// ============================================================================
// Context Generator - Generates CLAUDE.md/agents.md from workspace state
// ============================================================================

import { WorkspaceState, type ExtractedItem, type ParseResult } from '../types'
// Import from registry directly to avoid circular dependency through plugins/index.ts
import { pluginRegistry } from '../plugins/registry'
import {
  FRAMEWORK_RULES,
  FRAMEWORK_START_MARKER,
  FRAMEWORK_END_MARKER,
} from './frameworkRules'

export const FOCUS_START_MARKER = '<!-- LOOKING_GLASS_CURRENT_FOCUS_START -->'
export const FOCUS_END_MARKER = '<!-- LOOKING_GLASS_CURRENT_FOCUS_END -->'

export const PACKET_SECTION_START = '<!-- CONTEXT_PACKET_START -->'
export const PACKET_SECTION_END = '<!-- CONTEXT_PACKET_END -->'

// ============================================================================
// Options
// ============================================================================

export interface GeneratorOptions {
  includeFramework: boolean
  includeFocus: boolean
  maxItems: number
  includeSourceRefs: boolean
}

const defaultOptions: GeneratorOptions = {
  includeFramework: true,
  includeFocus: true,
  maxItems: 10,
  includeSourceRefs: true,
}

// ============================================================================
// Focus Section Generator
// ============================================================================

function generateFocusContent(state: WorkspaceState): string {
  const lines: string[] = ['## Current Focus']

  // 1. Focus mode description
  if (state.focus.mode === 'single' && state.focus.focusedNodeId) {
    lines.push('')
    lines.push(`**Focused on:** \`${state.focus.focusedNodeId}\``)

    // Show ancestry (focused path)
    const parts = state.focus.focusedNodeId.split('/')
    if (parts.length > 1) {
      lines.push('')
      lines.push('**Path:**')
      for (let i = 1; i <= parts.length; i++) {
        const indent = '  '.repeat(i - 1)
        lines.push(`${indent}- ${parts[i - 1]}`)
      }
    }
  } else if (state.focus.mode === 'custom' && state.focus.customNodeIds.length > 0) {
    lines.push('')
    lines.push(`**Custom view:** ${state.focus.customNodeIds.length} items selected`)
    state.focus.customNodeIds.forEach(id => {
      lines.push(`- \`${id}\``)
    })
  } else {
    lines.push('')
    lines.push('**Mode:** Full graph view')
  }

  // 2. Open panels in accordion
  if (state.openPanels.length > 0) {
    lines.push('')
    lines.push('### Open Panels')
    state.openPanels.forEach(panelId => {
      const isExpanded = state.expandedPanel === panelId
      lines.push(`- ${isExpanded ? '**' : ''}\`${panelId}\`${isExpanded ? '** (expanded)' : ''}`)
    })
  }

  // 3. Currently visible section in accordion
  if (state.visibleSection) {
    lines.push('')
    lines.push('### Visible Section')
    lines.push(`**File:** \`${state.visibleSection.fileId}\``)
    lines.push(`**Section:** ${state.visibleSection.sectionTitle}`)
    lines.push(`**Lines:** ${state.visibleSection.startLine}-${state.visibleSection.endLine}`)
  }

  // 4. Extract and show relevant items from focused/expanded documents
  const relevantDocIds = new Set<string>()

  if (state.focus.focusedNodeId) {
    relevantDocIds.add(state.focus.focusedNodeId)
  }
  if (state.expandedPanel) {
    relevantDocIds.add(state.expandedPanel)
  }
  state.openPanels.forEach(id => relevantDocIds.add(id))

  // Collect all extractions from relevant documents
  const allResults = new Map<string, ParseResult<ExtractedItem>>()

  relevantDocIds.forEach(docId => {
    const doc = state.documents.get(docId)
    if (!doc) return

    doc.extractions.forEach((result, pluginId) => {
      if (!result?.items || result.items.length === 0) return
      const existing = allResults.get(pluginId)
      if (!existing) {
        allResults.set(pluginId, {
          pluginId,
          items: [...result.items],
          rawMatches: result.rawMatches ? [...result.rawMatches] : [],
        })
        return
      }
      existing.items.push(...result.items)
      if (result.rawMatches?.length) {
        existing.rawMatches.push(...result.rawMatches)
      }
    })
  })

  // Generate context markdown for each plugin's items
  if (allResults.size > 0) {
    lines.push('')
    lines.push('### Extracted Data')

    const contextMarkdown = pluginRegistry.toContextMarkdown(
      allResults as any,
      { maxItems: 10, includeSource: true }
    )

    if (contextMarkdown) {
      lines.push(contextMarkdown)
    }
  }

  lines.push('')
  lines.push('*This section is managed by Looking Glass. Edit the source files directly.*')

  return lines.join('\n')
}

// ============================================================================
// Full File Generator
// ============================================================================

export function generateClaudeMd(
  state: WorkspaceState,
  existingContent: string,
  options: Partial<GeneratorOptions> = {}
): string {
  const opts = { ...defaultOptions, ...options }
  let content = existingContent

  // Update framework section
  if (opts.includeFramework) {
    content = updateManagedSection(
      content,
      FRAMEWORK_START_MARKER,
      FRAMEWORK_END_MARKER,
      FRAMEWORK_RULES
    )
  }

  // Update focus section
  if (opts.includeFocus) {
    const focusContent = generateFocusContent(state)
    content = updateManagedSection(
      content,
      FOCUS_START_MARKER,
      FOCUS_END_MARKER,
      focusContent
    )
  }

  return content
}

export function generateAgentsMd(
  state: WorkspaceState,
  existingContent: string,
  options: Partial<GeneratorOptions> = {}
): string {
  // agents.md uses same format but may have different defaults
  return generateClaudeMd(state, existingContent, {
    ...options,
    includeFramework: false, // agents.md doesn't need framework rules
  })
}

export function generateGeminiMd(
  state: WorkspaceState,
  existingContent: string,
  options: Partial<GeneratorOptions> = {}
): string {
  // GEMINI.md uses the same managed section markers and can share the same generator.
  return generateClaudeMd(state, existingContent, options)
}

// ============================================================================
// Helpers
// ============================================================================

function updateManagedSection(
  content: string,
  startMarker: string,
  endMarker: string,
  newContent: string
): string {
  const startIdx = content.indexOf(startMarker)
  const endIdx = content.indexOf(endMarker)

  const wrappedContent = `${startMarker}\n${newContent}\n${endMarker}`

  if (startIdx === -1 || endIdx === -1) {
    // Markers not found - append at end
    return content + '\n\n' + wrappedContent
  }

  // Replace existing section
  return (
    content.slice(0, startIdx) +
    wrappedContent +
    content.slice(endIdx + endMarker.length)
  )
}

// ============================================================================
// Packet Section Helpers
// ============================================================================

/**
 * Inject or replace the packet managed section in CLAUDE.md content.
 */
export function injectPacketIntoContent(
  fileContent: string,
  packetSection: string,
): string {
  const wrapped = `${PACKET_SECTION_START}\n${packetSection}\n${PACKET_SECTION_END}`
  const startIdx = fileContent.indexOf(PACKET_SECTION_START)
  const endIdx = fileContent.indexOf(PACKET_SECTION_END)

  if (startIdx === -1 || endIdx === -1) {
    return fileContent + '\n\n' + wrapped
  }

  return (
    fileContent.slice(0, startIdx) +
    wrapped +
    fileContent.slice(endIdx + PACKET_SECTION_END.length)
  )
}

/**
 * Remove the packet managed section from CLAUDE.md content.
 */
export function removePacketSection(fileContent: string): string {
  const startIdx = fileContent.indexOf(PACKET_SECTION_START)
  const endIdx = fileContent.indexOf(PACKET_SECTION_END)

  if (startIdx === -1 || endIdx === -1) return fileContent

  const before = fileContent.slice(0, startIdx).replace(/\n+$/, '')
  const after = fileContent.slice(endIdx + PACKET_SECTION_END.length).replace(/^\n+/, '')

  return before + (after ? '\n\n' + after : '')
}

// ============================================================================
// Snapshot Generator (for logging/debugging)
// ============================================================================

export function generateStateSnapshot(state: WorkspaceState): string {
  const lines: string[] = [
    '# Workspace State Snapshot',
    '',
    `**Project:** ${state.projectPath || 'None'}`,
    `**Tree Items:** ${state.treeItems.length}`,
    `**Documents Loaded:** ${state.documents.size}`,
    '',
    '## Focus',
    `- Mode: ${state.focus.mode}`,
    `- Focused Node: ${state.focus.focusedNodeId || 'None'}`,
    `- Custom Nodes: ${state.focus.customNodeIds.length}`,
    '',
    '## Accordion',
    `- Open Panels: ${state.openPanels.join(', ') || 'None'}`,
    `- Expanded: ${state.expandedPanel || 'None'}`,
    '',
    '## View Settings',
    `- Card Scale: ${state.cardScale}`,
    `- Collapsed Folders: ${state.collapsedFolders.size}`,
    `- Tree Widgets: ${state.treeWidgetFolders.size}`,
  ]

  return lines.join('\n')
}
