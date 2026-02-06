import { DocumentGraph } from './DocumentGraph'
import { useTheme } from '../compat/design-system'
// TODO: app panel compat
// import { useOpenFileAction, useProjectSettingsByPath } from '../../../app/panels'
import { layoutPrimitives } from '../compat/layoutPrimitives'

export function ContextGraphPanel({
  isVisible = true,
  projectPath: projectPathProp,
}: { isVisible?: boolean; projectPath?: string }) {
  const { colors } = useTheme()
  // TODO: app panel compat
  // const projectSettingsByPath = useProjectSettingsByPath()
  const projectPath = projectPathProp ?? null
  // TODO: app panel compat
  // const activeProjectSettings = projectPath ? projectSettingsByPath[projectPath] ?? null : null
  const activeProjectSettings = null as any
  // TODO: app panel compat
  // const onOpenFile = useOpenFileAction()
  const onOpenFile = null as any

  if (!projectPath) {
    return (
      <div
        style={{
          flex: 1,
          ...layoutPrimitives.row,
          alignItems: 'center',
          justifyContent: 'center',
          background: colors.bgPrimary,
          color: colors.textMuted,
        }}
      >
        <div style={{ fontSize: 12 }}>No project selected</div>
      </div>
    )
  }

  return (
    <div style={{ ...layoutPrimitives.panelShell, flex: 1 }}>
      <DocumentGraph
        projectPath={projectPath}
        projectSettings={activeProjectSettings ?? undefined}
        onOpenFile={onOpenFile ?? undefined}
        isVisible={isVisible}
      />
    </div>
  )
}
