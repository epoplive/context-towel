import { describe, it, expect, beforeEach } from 'vitest'
import { blockRegistry } from '../blocks/registry'
import { registerFormBlock, formBlockDefinition } from '../plugins/form'
import { parseMarkdownBlocks } from '../blocks/markdown'
import type { FormBlockData } from '../blocks/form'

describe('Form Plugin', () => {
  beforeEach(() => {
    blockRegistry.clear()
    registerFormBlock()
  })

  it('should register form block definition', () => {
    expect(blockRegistry.has('form')).toBe(true)
    const def = blockRegistry.get('form')
    expect(def?.type).toBe('form')
    expect(def?.name).toBe('Form')
    expect(def?.schemaVersion).toBe(1)
  })

  it('should have components registered', () => {
    const def = blockRegistry.get('form')
    expect(def?.components?.card).toBeDefined()
    expect(def?.components?.inline).toBeDefined()
  })

  it('should parse simple form block from markdown', () => {
    const markdown = `
# Test

\`\`\`form
id: contact-form
title: Contact Form
description: Get in touch with us
mode: single
steps:
  - id: step1
    fields:
      - id: name
        label: Full Name
        type: text
        required: true
      - id: email
        label: Email Address
        type: email
        required: true
      - id: message
        label: Message
        type: textarea
        placeholder: Tell us what you need...
\`\`\`
    `.trim()

    const result = parseMarkdownBlocks(markdown, 'test.md')
    const formBlocks = result.blocks.filter(b => b.type === 'form')

    expect(formBlocks).toHaveLength(1)
    const formData = formBlocks[0].data as FormBlockData
    expect(formData).toBeDefined()
    expect(formData.id).toBe('contact-form')
    expect(formData.title).toBe('Contact Form')
    expect(formData.mode).toBe('single')
    expect(formData.steps).toHaveLength(1)
    expect(formData.steps?.[0].fields).toHaveLength(3)
  })

  it('should parse multi-step form', () => {
    const markdown = `
\`\`\`form
id: onboarding
title: User Onboarding
mode: multi-step
steps:
  - id: personal-info
    title: Personal Information
    fields:
      - id: name
        label: Name
        type: text
        required: true
      - id: age
        label: Age
        type: number
  - id: preferences
    title: Preferences
    fields:
      - id: newsletter
        label: Subscribe to newsletter
        type: checkbox
      - id: theme
        label: Theme
        type: select
        options:
          - id: light
            label: Light
          - id: dark
            label: Dark
\`\`\`
    `.trim()

    const result = parseMarkdownBlocks(markdown, 'test.md')
    const formBlocks = result.blocks.filter(b => b.type === 'form')

    expect(formBlocks).toHaveLength(1)
    const formData = formBlocks[0].data as FormBlockData
    expect(formData.mode).toBe('multi-step')
    expect(formData.steps).toHaveLength(2)
    expect(formData.steps?.[0].title).toBe('Personal Information')
    expect(formData.steps?.[1].title).toBe('Preferences')
  })

  it('should handle conditional fields', () => {
    const markdown = `
\`\`\`form
id: conditional
title: Conditional Form
steps:
  - id: step1
    fields:
      - id: has-account
        label: Do you have an account?
        type: select
        options:
          - id: 'yes'
            label: Yes
          - id: 'no'
            label: No
      - id: login
        label: Login Email
        type: email
        when:
          field: has-account
          is: 'yes'
      - id: signup
        label: Create Email
        type: email
        when:
          field: has-account
          is: 'no'
\`\`\`
    `.trim()

    const result = parseMarkdownBlocks(markdown, 'test.md')
    const formBlocks = result.blocks.filter(b => b.type === 'form')

    expect(formBlocks).toHaveLength(1)
    const formData = formBlocks[0].data as FormBlockData
    const fields = formData.steps?.[0].fields || []

    expect(fields).toHaveLength(3)
    expect(fields[1].when?.field).toBe('has-account')
    expect(fields[1].when?.is).toBe('yes')
    expect(fields[2].when?.is).toBe('no')
  })

  it('should serialize form to context markdown', () => {
    const formData: FormBlockData = {
      id: 'test-form',
      title: 'Test Form',
      description: 'A test form',
      responses: {
        name: 'John Doe',
        email: 'john@example.com',
      },
    }

    const blocks = [
      { type: 'form', data: formData, source: { filePath: '', range: { startOffset: 0, endOffset: 0, startLine: 0, endLine: 0 }, raw: '' } }
    ]

    const markdown = formBlockDefinition.toContextMarkdown?.(blocks)
    expect(markdown).toContain('### Test Form')
    expect(markdown).toContain('A test form')
    expect(markdown).toContain('**Responses:**')
    expect(markdown).toContain('- name: John Doe')
    expect(markdown).toContain('- email: john@example.com')
  })

  it('should handle multiselect field type', () => {
    const markdown = `
\`\`\`form
id: interests
title: Select Interests
steps:
  - id: step1
    fields:
      - id: topics
        label: Topics of Interest
        type: multiselect
        options:
          - id: tech
            label: Technology
          - id: design
            label: Design
          - id: business
            label: Business
\`\`\`
    `.trim()

    const result = parseMarkdownBlocks(markdown, 'test.md')
    const formBlocks = result.blocks.filter(b => b.type === 'form')

    expect(formBlocks).toHaveLength(1)
    const formData = formBlocks[0].data as FormBlockData
    const field = formData.steps?.[0].fields[0]

    expect(field?.type).toBe('multiselect')
    expect(field?.options).toHaveLength(3)
  })
})
