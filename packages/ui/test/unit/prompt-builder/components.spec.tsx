import { describe, it, expect } from 'vitest'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { PromptBuilderProvider } from '../../../src/prompt-builder/context'
import { VariableEditor } from '../../../src/prompt-builder/components/VariableEditor'
import { VariableInput } from '../../../src/prompt-builder/components/VariableInput'
import { TemplateList } from '../../../src/prompt-builder/components/TemplateList'
import { PromptBuilder } from '../../../src/prompt-builder/components/PromptBuilder'
import type { VersionedTemplate } from '../../../src/prompt-builder/types'

// Helper: render inside provider
function renderInProvider(ui: React.ReactElement, providerProps?: Record<string, unknown>) {
  const wrapped = createElement(
    PromptBuilderProvider,
    { ...providerProps, children: ui } as React.Attributes & { children: React.ReactNode },
  )
  return renderToString(wrapped)
}

describe('VariableEditor', () => {
  it('renders without crashing', () => {
    const html = renderToString(
      createElement(VariableEditor, {
        variables: {},
        onChange: () => {},
      }),
    )
    expect(html).toContain('data-testid="variable-editor"')
    expect(html).toContain('Template Variables')
  })

  it('renders existing variables', () => {
    const html = renderToString(
      createElement(VariableEditor, {
        variables: {
          name: { type: 'text', label: 'Name', description: 'Enter your name' },
          role: { type: 'select', label: 'Role', options: ['admin', 'user'] },
        },
        onChange: () => {},
      }),
    )
    expect(html).toContain('data-testid="variable-item-name"')
    expect(html).toContain('data-testid="variable-item-role"')
    expect(html).toContain('Name')
    expect(html).toContain('Role')
  })

  it('renders add variable form', () => {
    const html = renderToString(
      createElement(VariableEditor, {
        variables: {},
        onChange: () => {},
      }),
    )
    expect(html).toContain('data-testid="add-variable-form"')
    expect(html).toContain('Add New Variable')
  })
})

describe('VariableInput', () => {
  const templateWithVars: VersionedTemplate = {
    id: 'test',
    name: 'Test',
    description: 'Test template',
    category: 'general',
    prompt: 'Hello {{name}}',
    version: '1.0.0',
    variables: {
      name: { type: 'text', label: 'Name', placeholder: 'Enter name' },
      count: { type: 'number', label: 'Count', default: 5 },
      agree: { type: 'boolean', label: 'Agree' },
      color: { type: 'select', label: 'Color', options: ['red', 'blue'] },
      bio: { type: 'textarea', label: 'Bio' },
    },
  }

  it('renders without crashing', () => {
    const html = renderToString(
      createElement(VariableInput, {
        template: templateWithVars,
        values: {},
        onChange: () => {},
      }),
    )
    expect(html).toContain('data-testid="variable-input"')
    expect(html).toContain('Customize Template')
  })

  it('renders all variable fields', () => {
    const html = renderToString(
      createElement(VariableInput, {
        template: templateWithVars,
        values: {},
        onChange: () => {},
      }),
    )
    expect(html).toContain('data-testid="variable-field-name"')
    expect(html).toContain('data-testid="variable-field-count"')
    expect(html).toContain('data-testid="variable-field-agree"')
    expect(html).toContain('data-testid="variable-field-color"')
    expect(html).toContain('data-testid="variable-field-bio"')
  })

  it('shows no-variables message when template has no variables', () => {
    const template: VersionedTemplate = {
      id: 'test',
      name: 'Test',
      description: 'Desc',
      category: 'general',
      prompt: 'Hello',
      version: '1.0.0',
    }
    const html = renderToString(
      createElement(VariableInput, {
        template,
        values: {},
        onChange: () => {},
      }),
    )
    expect(html).toContain('data-testid="no-variables"')
    expect(html).toContain('no customizable variables')
  })

  it('renders select options', () => {
    const html = renderToString(
      createElement(VariableInput, {
        template: templateWithVars,
        values: {},
        onChange: () => {},
      }),
    )
    expect(html).toContain('red')
    expect(html).toContain('blue')
  })
})

describe('TemplateList', () => {
  const templates: VersionedTemplate[] = [
    {
      id: 't1',
      name: 'Coding Template',
      description: 'For coding',
      category: 'coding',
      prompt: 'Code prompt',
      version: '1.0.0',
      author: 'system',
    },
    {
      id: 't2',
      name: 'User Template',
      description: 'Custom template',
      category: 'custom',
      prompt: 'Custom prompt',
      version: '1.0.0',
      author: 'user',
    },
  ]

  it('renders without crashing', () => {
    const html = renderToString(
      createElement(TemplateList, {
        templates,
        onSelect: () => {},
      }),
    )
    expect(html).toContain('data-testid="template-list-panel"')
  })

  it('renders all templates', () => {
    const html = renderToString(
      createElement(TemplateList, {
        templates,
        onSelect: () => {},
      }),
    )
    expect(html).toContain('Coding Template')
    expect(html).toContain('User Template')
    expect(html).toContain('data-testid="template-item-t1"')
    expect(html).toContain('data-testid="template-item-t2"')
  })

  it('renders search input', () => {
    const html = renderToString(
      createElement(TemplateList, {
        templates,
        onSelect: () => {},
      }),
    )
    expect(html).toContain('data-testid="template-search-input"')
  })

  it('renders category filter buttons', () => {
    const html = renderToString(
      createElement(TemplateList, {
        templates,
        onSelect: () => {},
      }),
    )
    expect(html).toContain('data-testid="filter-all"')
    expect(html).toContain('data-testid="filter-coding"')
    expect(html).toContain('data-testid="filter-custom"')
  })

  it('renders action buttons when handlers provided', () => {
    const html = renderToString(
      createElement(TemplateList, {
        templates,
        onSelect: () => {},
        onEdit: () => {},
        onDelete: () => {},
        onDuplicate: () => {},
      }),
    )
    // Edit shown for all, delete only for user templates
    expect(html).toContain('data-testid="edit-btn-t1"')
    expect(html).toContain('data-testid="edit-btn-t2"')
    expect(html).not.toContain('data-testid="delete-btn-t1"') // system template
    expect(html).toContain('data-testid="delete-btn-t2"') // user template
    expect(html).toContain('data-testid="duplicate-btn-t1"')
  })

  it('shows no-templates message for empty list', () => {
    const html = renderToString(
      createElement(TemplateList, {
        templates: [],
        onSelect: () => {},
      }),
    )
    expect(html).toContain('data-testid="no-templates"')
  })
})

describe('PromptBuilder', () => {
  it('renders without crashing inside provider', () => {
    const html = renderInProvider(
      createElement(PromptBuilder, {
        onUpdate: () => {},
        onClose: () => {},
      }),
    )
    expect(html).toContain('data-testid="prompt-builder"')
    expect(html).toContain('Prompt Builder')
  })

  it('renders tab bar', () => {
    const html = renderInProvider(
      createElement(PromptBuilder, {
        onUpdate: () => {},
        onClose: () => {},
      }),
    )
    expect(html).toContain('data-testid="tab-chains"')
    expect(html).toContain('data-testid="tab-templates"')
    expect(html).toContain('data-testid="tab-variables"')
  })

  it('renders footer with apply button', () => {
    const html = renderInProvider(
      createElement(PromptBuilder, {
        onUpdate: () => {},
        onClose: () => {},
      }),
    )
    expect(html).toContain('data-testid="apply-chain-btn"')
    expect(html).toContain('data-testid="cancel-btn"')
  })

  it('renders preset templates in templates panel', () => {
    const html = renderInProvider(
      createElement(PromptBuilder, {
        onUpdate: () => {},
        onClose: () => {},
      }),
    )
    // The default tab is templates, so preset templates should be visible
    expect(html).toContain('data-testid="templates-panel"')
    expect(html).toContain('Coding Agent')
    expect(html).toContain('General Assistant')
  })

  it('renders with initial prompts', () => {
    const html = renderInProvider(
      createElement(PromptBuilder, {
        currentPrompts: [
          { id: 'p1', type: 'main', source: 'user', content: 'Hello world' },
        ],
        onUpdate: () => {},
        onClose: () => {},
      }),
      {
        initialState: {
          prompts: [
            { id: 'p1', type: 'main', source: 'user', content: 'Hello world' },
          ],
        },
      },
    )
    // SSR inserts HTML comments for interpolation boundaries
    expect(html).toContain('prompts in chain')
  })

  it('renders close button', () => {
    const html = renderInProvider(
      createElement(PromptBuilder, {
        onUpdate: () => {},
        onClose: () => {},
      }),
    )
    expect(html).toContain('data-testid="close-btn"')
  })
})
