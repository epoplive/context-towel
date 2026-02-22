/**
 * @context-towel/ui prompt-builder module.
 *
 * Extracted from Felix prompt-manager. Self-contained prompt builder UI
 * that works standalone or integrated with PromptManagementPort.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type {
  TemplateVariable,
  VersionedTemplate,
  SystemPrompt,
  VariableDefinition,
  VariableValue,
  CodeIndexerRule,
  ProjectInfo,
  PromptChainTemplate,
  RulesProvider,
  TemplateCategory,
} from './types'

export { TEMPLATE_CATEGORIES } from './types'

// ---------------------------------------------------------------------------
// Context & Provider
// ---------------------------------------------------------------------------

export {
  PromptBuilderProvider,
  usePromptBuilderStore,
  usePromptPort,
  useRulesProvider,
  type PromptBuilderProviderProps,
  type PromptManagementPort,
} from './context'

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export {
  createPromptBuilderStore,
  type PromptBuilderState,
  type PromptBuilderSnapshot,
  type PromptBuilderActions,
} from './store'

// ---------------------------------------------------------------------------
// Components
// ---------------------------------------------------------------------------

export { PromptBuilder, type PromptBuilderProps } from './components/PromptBuilder'
export { VariableEditor, type VariableEditorProps } from './components/VariableEditor'
export { VariableInput, type VariableInputProps } from './components/VariableInput'
export {
  QuickTemplateSelector,
  type QuickTemplateSelectorProps,
} from './components/QuickTemplateSelector'
export { TemplateList, type TemplateListProps } from './components/TemplateList'

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------

export {
  composePrompt,
  buildRulesPrompt,
  type PromptCompositionConfig,
  type PromptCompositionResult,
} from './services/prompt-composer'

export {
  createVariable,
  updateVariable,
  deleteVariable,
  getVariableValues,
  setVariableValues,
  getCombinedValues,
  getVariablesByScope,
  fillTemplate,
} from './services/variable-manager'

export {
  getPresetTemplates,
  mergeTemplates,
  createTemplate,
  duplicateTemplate,
  createEmptyDraft,
  fillVersionedTemplate,
  normalizeCategory,
} from './services/template-registry'

// ---------------------------------------------------------------------------
// Utils
// ---------------------------------------------------------------------------

export {
  validateTemplate,
  validateTemplates,
  sanitizeTemplate,
  generateTemplateId,
  isTemplateSafe,
  createSafeTemplate,
  type ValidationResult,
  type SystemPromptTemplate,
} from './utils/template-validation'

export {
  exportTemplates,
  downloadTemplates,
  importTemplates,
  readFileAsText,
  validateImportFile,
  exportTemplatesFile,
  parseTemplateImport,
  type TemplateExportData,
  type ImportResult,
} from './utils/template-io'

// ---------------------------------------------------------------------------
// Template presets
// ---------------------------------------------------------------------------

export { PRESET_TEMPLATES } from './templates/presets'
