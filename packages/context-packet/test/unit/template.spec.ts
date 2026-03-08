import { describe, it, expect } from 'vitest'
import { generatePacketTemplate } from '../../src/template'

describe('generatePacketTemplate', () => {
  it('generates a packet with all sections', () => {
    const result = generatePacketTemplate('Auth System')

    expect(result).toContain('# Packet: Auth System')
    expect(result).toContain('## Problem Vector')
    expect(result).toContain('## Architecture')
    expect(result).toContain('## Data Model')
    expect(result).toContain('## Patterns Applied')
    expect(result).toContain('## Active Tasks')
    expect(result).toContain('## Session Log')
    expect(result).toContain('## Tried & Pivoted')
    expect(result).toContain('## Linked')
  })

  it('includes plan file reference when provided', () => {
    const result = generatePacketTemplate('Auth System', {
      planFileRef: '.context/working/backend-plan.md',
    })

    expect(result).toContain('Created packet from plan: .context/working/backend-plan.md')
    expect(result).toContain('- Plan: `.context/working/backend-plan.md`')
  })

  it('seeds tasks when provided', () => {
    const tasks = `~~~task
id: auth-1
title: Implement auth middleware
status: todo
~~~`

    const result = generatePacketTemplate('Auth System', { seedTasks: tasks })

    expect(result).toContain('~~~task')
    expect(result).toContain('id: auth-1')
    expect(result).toContain('title: Implement auth middleware')
  })

  it('uses comment placeholders when no options provided', () => {
    const result = generatePacketTemplate('Empty Packet')

    expect(result).toContain('<!-- describe current broken/missing state -->')
    expect(result).toContain('<!-- Add ~~~task blocks here -->')
    expect(result).toContain('<!-- Link plan files, docs, session transcripts -->')
  })
})
