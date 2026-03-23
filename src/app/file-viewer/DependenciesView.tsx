import type { TaskData, ThemeTokens } from '@context-towel/card-library'
import { statusColors, priorityColors } from '@context-towel/card-library'
import type { ColorTokens } from '@context-towel/context-graph/compat/design-system'

interface DependenciesViewProps {
  tasks: TaskData[]
  theme: ThemeTokens
  colors: ColorTokens
}

export function DependenciesView({ tasks, theme, colors }: DependenciesViewProps) {
  if (tasks.length === 0) {
    return (
      <div style={{
        color: theme.textMuted,
        fontSize: 13,
        fontStyle: 'italic',
        padding: 32,
        textAlign: 'center',
      }}>
        No tasks found in this planning file.
      </div>
    )
  }

  // Index tasks by id and title for resolving blocked-by references
  const byId = new Map<string, TaskData>()
  const byTitle = new Map<string, TaskData>()
  for (const t of tasks) {
    if (t.id) byId.set(t.id, t)
    byTitle.set(t.title.toLowerCase(), t)
  }

  const resolveRef = (ref: string): TaskData | undefined => {
    const clean = ref.replace(/^\[\[|\]\]$/g, '').trim()
    return byId.get(clean) ?? byTitle.get(clean.toLowerCase())
  }

  const withDeps = tasks.filter(t => t.blockedBy.length > 0 || t.blocks.length > 0)
  const noDeps = tasks.filter(t => t.blockedBy.length === 0 && t.blocks.length === 0)

  const statusColor = (status: string): string =>
    statusColors[status as keyof typeof statusColors] ?? '#6b7280'

  const priorityColor = (priority: string): string =>
    priorityColors[priority as keyof typeof priorityColors] ?? '#6b7280'

  const renderTask = (task: TaskData) => (
    <div
      key={task.id || task.title}
      style={{
        borderRadius: 6,
        border: `1px solid ${colors.borderPrimary}`,
        background: colors.bgSecondary,
        padding: '10px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      {/* Title row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: statusColor(task.status),
            flexShrink: 0,
            display: 'inline-block',
          }}
          title={task.status}
        />
        <span style={{ fontWeight: 600, fontSize: 13, color: colors.textPrimary, flex: 1 }}>
          {task.title}
        </span>
        {task.id && (
          <span style={{ fontSize: 10, color: colors.textMuted, fontFamily: 'monospace' }}>
            {task.id}
          </span>
        )}
        <span
          style={{
            fontSize: 10,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.4px',
            padding: '1px 5px',
            borderRadius: 3,
            background: `${priorityColor(task.priority)}22`,
            color: priorityColor(task.priority),
          }}
        >
          {task.priority}
        </span>
      </div>

      {/* Blocked-by */}
      {task.blockedBy.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, paddingLeft: 16 }}>
          <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 600, flexShrink: 0 }}>
            blocked by
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {task.blockedBy.map(ref => {
              const dep = resolveRef(ref)
              return (
                <span
                  key={ref}
                  title={dep ? `${dep.status} — ${dep.title}` : ref}
                  style={{
                    fontSize: 11,
                    padding: '1px 6px',
                    borderRadius: 3,
                    border: `1px solid ${dep ? statusColor(dep.status) : colors.borderSecondary}`,
                    color: dep ? statusColor(dep.status) : colors.textMuted,
                    background: dep ? `${statusColor(dep.status)}18` : 'transparent',
                  }}
                >
                  {dep ? dep.title : ref.replace(/^\[\[|\]\]$/g, '')}
                </span>
              )
            })}
          </div>
        </div>
      )}

      {/* Blocks */}
      {task.blocks.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, paddingLeft: 16 }}>
          <span style={{ fontSize: 11, color: colors.accent, fontWeight: 600, flexShrink: 0 }}>
            unblocks
          </span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {task.blocks.map(ref => {
              const dep = resolveRef(ref)
              return (
                <span
                  key={ref}
                  title={dep ? `${dep.status} — ${dep.title}` : ref}
                  style={{
                    fontSize: 11,
                    padding: '1px 6px',
                    borderRadius: 3,
                    border: `1px solid ${colors.borderSecondary}`,
                    color: colors.textSecondary,
                  }}
                >
                  {dep ? dep.title : ref.replace(/^\[\[|\]\]$/g, '')}
                </span>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
      {withDeps.length > 0 && (
        <section>
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.6px',
            color: colors.textMuted,
            marginBottom: 10,
          }}>
            Tasks with dependencies ({withDeps.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {withDeps.map(renderTask)}
          </div>
        </section>
      )}

      {noDeps.length > 0 && (
        <section>
          <div style={{
            fontSize: 11,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.6px',
            color: colors.textMuted,
            marginBottom: 10,
          }}>
            Independent tasks ({noDeps.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {noDeps.map(renderTask)}
          </div>
        </section>
      )}
    </div>
  )
}
