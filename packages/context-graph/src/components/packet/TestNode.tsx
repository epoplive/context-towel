// ============================================================================
// TestNode — Compact pill for test-type AICCL nodes
//
// Shows a test file path with pass/fail/pending indicator. These attach
// to work nodes via edges and show what tests verify the work.
// ============================================================================

import { memo } from 'react'
import { Handle, Position } from '@xyflow/react'
import { useTheme } from '../../compat/design-system'

export type TestStatus = 'pass' | 'fail' | 'pending'

export interface TestNodeData {
  path: string
  body?: string
  state?: string
  /** Derived from body content or external test run results */
  testStatus?: TestStatus
}

const STATUS_CONFIG: Record<TestStatus, { color: string; label: string }> = {
  pass:    { color: '#22c55e', label: 'PASS' },
  fail:    { color: '#ef4444', label: 'FAIL' },
  pending: { color: '#f59e0b', label: 'TEST' },
}

function StatusDot({ status }: { status: TestStatus }) {
  const config = STATUS_CONFIG[status]
  return (
    <div style={{
      width: 8,
      height: 8,
      borderRadius: '50%',
      background: config.color,
      boxShadow: `0 0 4px ${config.color}50`,
      flexShrink: 0,
    }} />
  )
}

function shortTestPath(path: string): string {
  const parts = path.split('/')
  // Show the test filename
  const filename = parts[parts.length - 1]
  if (parts.length > 2) {
    return '.../' + parts.slice(-2).join('/')
  }
  return filename || path
}

function deriveTestStatus(state?: string, body?: string): TestStatus {
  if (state === 'resolved' || state === 'promoted') return 'pass'
  if (state === 'failed') return 'fail'
  if (body) {
    const lower = body.toLowerCase()
    if (lower.includes('pass') || lower.includes('✓') || lower.includes('success')) return 'pass'
    if (lower.includes('fail') || lower.includes('✗') || lower.includes('error')) return 'fail'
  }
  return 'pending'
}

export const TestNode = memo(({ data, selected }: { data: TestNodeData; selected?: boolean }) => {
  const { colors } = useTheme()
  const status = data.testStatus ?? deriveTestStatus(data.state, data.body)
  const config = STATUS_CONFIG[status]

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      background: colors.bgSecondary,
      border: `1.5px solid ${selected ? config.color : colors.borderPrimary}`,
      borderLeft: `3px solid ${config.color}`,
      borderRadius: 8,
      padding: '6px 10px',
      minWidth: 120,
      maxWidth: 260,
      cursor: 'default',
    }}>
      <Handle type="target" id="left" position={Position.Left} style={{ background: config.color, width: 6, height: 6 }} />
      <Handle type="source" id="right" position={Position.Right} style={{ background: config.color, width: 6, height: 6 }} />
      <Handle type="target" id="top" position={Position.Top} style={{ background: config.color, width: 6, height: 6 }} />
      <Handle type="source" id="bottom" position={Position.Bottom} style={{ background: config.color, width: 6, height: 6 }} />

      <StatusDot status={status} />

      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
        <div style={{
          fontSize: 8,
          fontWeight: 800,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
          color: config.color,
          marginBottom: 1,
        }}>
          {config.label}
        </div>
        <div style={{
          fontSize: 10,
          fontFamily: 'monospace',
          color: colors.textSecondary,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
          title={data.path}
        >
          {shortTestPath(data.path)}
        </div>
      </div>
    </div>
  )
})
