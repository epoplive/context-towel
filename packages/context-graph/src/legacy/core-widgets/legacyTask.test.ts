import { describe, it, expect } from 'vitest'
import { parseLegacyTaskBlock, splitLegacyTaskBlocks, taskBlockToWidgetSpec } from './legacyTask'

describe('legacy task widgets', () => {
  it('parses task blocks into widget specs', () => {
    const content = [
      'Before',
      '',
      '```task',
      'title: Demo Task',
      'status: in-progress',
      'priority: high',
      'tags: #alpha #beta',
      'blocked-by: TASK-1',
      'description: |',
      '  Do the thing',
      'checklist: |',
      '  - [x] first',
      '  - [ ] second',
      'notes: |',
      '  Note line',
      '```',
      '',
      'After',
    ].join('\n')

    const segments = splitLegacyTaskBlocks(content)
    const taskSegment = segments.find((segment) => segment.type === 'task')
    expect(taskSegment).toBeTruthy()

    const parsed = parseLegacyTaskBlock(taskSegment?.content ?? '')
    expect(parsed.title).toBe('Demo Task')
    expect(parsed.status).toBe('in-progress')
    expect(parsed.priority).toBe('high')
    expect(parsed.tags).toEqual(['#alpha', '#beta'])
    expect(parsed.blockedBy).toEqual(['TASK-1'])
    expect(parsed.checklist).toHaveLength(2)

    const widget = taskBlockToWidgetSpec(parsed)
    expect(widget.type).toBe('card')
    expect(widget.props?.title).toBe('Demo Task')
    expect(widget.children?.some((child) => child.type === 'field')).toBe(true)
  })
})
