// Compat layer — local replacements for LG dependencies
// All imports that used to reach into LG's app/ or features/ are re-routed here

export * from './design-system'
export * from './project-settings'
export { layoutPrimitives } from './layoutPrimitives'
export { useWindowVisibility, type WindowVisibilityState } from './useWindowVisibility'
export { noopFileService, noopFileParserService, fileService, fileParserService } from './services'
export type { FileServiceInterface, FileParserServiceInterface, ParsedContent, ParsedFileData, FileChangeEvent, FileChangeListener, ParserPlugin, ParseResult } from './services'
export { useFileParsing } from './useFileParsing'
export type { UseFileParsingResult, UseFileParsingOptions } from './useFileParsing'
export { normalizeProjectPath, projectIdFromPath, projectKey, isSameProject } from './projectIdentity'
export type { ProjectId, ProjectPath } from './projectIdentity'
export { getWindowScopedStorage } from './windowStorage'
export type { StorageLike } from './windowStorage'
