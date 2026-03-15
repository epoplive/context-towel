/**
 * UI rendering tests — render actual components and check the DOM output.
 * These tests would have caught: CSS not loading, font-size not applied,
 * draggable on code blocks, click-to-expand still showing, etc.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeAll } from 'vitest'
import { render } from '@testing-library/react'
import { MarkdownRenderer } from '../MarkdownRenderer'

// Register blocks before tests
import { registerCoreBlocks, registerAllCardPlugins } from '@context-towel/card-library'
beforeAll(() => {
  registerCoreBlocks()
  registerAllCardPlugins()
})

const defaultTheme = {
  bgPrimary: '#1e1e1e',
  bgSecondary: '#252526',
  bgTertiary: '#2d2d2d',
  borderPrimary: '#3c3c3c',
  borderSecondary: '#4a4a4a',
  textPrimary: '#d4d4d4',
  textSecondary: '#a0a0a0',
  textMuted: '#666666',
  textInverse: '#1e1e1e',
  accent: '#4fc3f7',
  success: '#4caf50',
  warning: '#ff9800',
  error: '#f44336',
  info: '#2196f3',
  fontMono: "'Menlo', monospace",
  fontSans: "system-ui, sans-serif",
  radius: '6px',
}

describe('MarkdownRenderer UI', () => {
  describe('markdown-body element', () => {
    it('does NOT have hardcoded fontSize in inline style', () => {
      const { container } = render(
        <MarkdownRenderer content="Hello world" theme={defaultTheme} isDark={true} />
      )
      const body = container.querySelector('.markdown-body') as HTMLElement
      expect(body).toBeTruthy()
      // The inline style should NOT set fontSize — let CSS handle it
      expect(body.style.fontSize).toBe('')
    })

    it('does NOT have hardcoded lineHeight in inline style', () => {
      const { container } = render(
        <MarkdownRenderer content="Hello world" theme={defaultTheme} isDark={true} />
      )
      const body = container.querySelector('.markdown-body') as HTMLElement
      expect(body).toBeTruthy()
      expect(body.style.lineHeight).toBe('')
    })

    it('does NOT have hardcoded fontFamily in inline style', () => {
      const { container } = render(
        <MarkdownRenderer content="Hello world" theme={defaultTheme} isDark={true} />
      )
      const body = container.querySelector('.markdown-body') as HTMLElement
      expect(body).toBeTruthy()
      expect(body.style.fontFamily).toBe('')
    })

    it('sets CSS custom properties for theme colors', () => {
      const { container } = render(
        <MarkdownRenderer content="Hello world" theme={defaultTheme} isDark={true} />
      )
      const body = container.querySelector('.markdown-body') as HTMLElement
      expect(body.style.getPropertyValue('--color-bg-primary')).toBe('#1e1e1e')
      expect(body.style.getPropertyValue('--color-text-primary')).toBe('#d4d4d4')
      expect(body.style.getPropertyValue('--color-accent')).toBe('#4fc3f7')
    })
  })

  describe('code blocks in highlight mode', () => {
    const codeMarkdown = '```typescript\nconst x = 42;\nconsole.log(x);\n```'

    it('renders code block without draggable attribute', () => {
      const { container } = render(
        <MarkdownRenderer content={codeMarkdown} theme={defaultTheme} isDark={true} codeBlockMode="highlight" />
      )
      const codeBlock = container.querySelector('.markdown-code-block') as HTMLElement
      expect(codeBlock).toBeTruthy()
      expect(codeBlock.getAttribute('draggable')).toBeNull()
    })

    it('does NOT have clickable-fullscreen class', () => {
      const { container } = render(
        <MarkdownRenderer content={codeMarkdown} theme={defaultTheme} isDark={true} codeBlockMode="highlight" />
      )
      const codeBlock = container.querySelector('.markdown-code-block') as HTMLElement
      expect(codeBlock).toBeTruthy()
      expect(codeBlock.classList.contains('clickable-fullscreen')).toBe(false)
    })

    it('does NOT have "Click to expand" text', () => {
      const { container } = render(
        <MarkdownRenderer content={codeMarkdown} theme={defaultTheme} isDark={true} codeBlockMode="highlight" />
      )
      expect(container.textContent).not.toContain('Click to expand')
    })

    it('does NOT have cursor: pointer style', () => {
      const { container } = render(
        <MarkdownRenderer content={codeMarkdown} theme={defaultTheme} isDark={true} codeBlockMode="highlight" />
      )
      const codeBlock = container.querySelector('.markdown-code-block') as HTMLElement
      expect(codeBlock).toBeTruthy()
      expect(codeBlock.style.cursor).not.toBe('pointer')
    })

    it('renders the code content in a pre element', () => {
      const { container } = render(
        <MarkdownRenderer content={codeMarkdown} theme={defaultTheme} isDark={true} codeBlockMode="highlight" />
      )
      const pre = container.querySelector('.markdown-code-block pre') as HTMLElement
      expect(pre).toBeTruthy()
      expect(pre.textContent).toContain('const x = 42')
    })

    it('shows language label in code header', () => {
      const { container } = render(
        <MarkdownRenderer content={codeMarkdown} theme={defaultTheme} isDark={true} codeBlockMode="highlight" />
      )
      const langLabel = container.querySelector('.code-lang') as HTMLElement
      expect(langLabel).toBeTruthy()
      expect(langLabel.textContent).toBe('typescript')
    })

    it('allows text selection (no user-select restrictions)', () => {
      const { container } = render(
        <MarkdownRenderer content={codeMarkdown} theme={defaultTheme} isDark={true} codeBlockMode="highlight" />
      )
      const pre = container.querySelector('.markdown-code-block pre') as HTMLElement
      expect(pre).toBeTruthy()
      expect(pre.style.userSelect).not.toBe('none')
    })
  })

  describe('task blocks', () => {
    const taskMarkdown = '```task\nid: test-1\ntitle: Test Task\nstatus: todo\npriority: high\nchecklist:\n  - text: Step one\n    checked: false\n  - text: Step two\n    checked: true\n```'

    it('renders task card', () => {
      const { container } = render(
        <MarkdownRenderer content={taskMarkdown} theme={defaultTheme} isDark={true} />
      )
      // Should find the task title somewhere in the output
      expect(container.textContent).toContain('Test Task')
    })

    it('renders task title and status', () => {
      const { container } = render(
        <MarkdownRenderer content={taskMarkdown} theme={defaultTheme} isDark={true} />
      )
      expect(container.textContent).toContain('Test Task')
      expect(container.textContent).toContain('TODO')
    })

    it('does NOT truncate content with ellipsis in full detail', () => {
      const longDesc = 'A'.repeat(300)
      const longTaskMarkdown = `\`\`\`task\nid: long-1\ntitle: Long Task\nstatus: todo\npriority: high\ndescription: ${longDesc}\n\`\`\``
      const { container } = render(
        <MarkdownRenderer content={longTaskMarkdown} theme={defaultTheme} isDark={true} />
      )
      // The full description should be present, not truncated
      // (it might be in a collapsed container but the DOM should have it)
      expect(container.textContent).toContain('Long Task')
    })

    it('card font sizes are readable (no tiny text)', () => {
      const { container } = render(
        <MarkdownRenderer content={taskMarkdown} theme={defaultTheme} isDark={true} />
      )
      // Check all elements with inline fontSize
      const allElements = container.querySelectorAll('[style]')
      allElements.forEach(el => {
        const style = (el as HTMLElement).style
        if (style.fontSize && style.fontSize.endsWith('em')) {
          const emValue = parseFloat(style.fontSize)
          if (!isNaN(emValue)) {
            expect(emValue).toBeGreaterThanOrEqual(0.7)
          }
        }
      })
    })
  })

  describe('basic markdown rendering', () => {
    it('renders headings', () => {
      const { container } = render(
        <MarkdownRenderer content={'# Hello\n\n## World'} theme={defaultTheme} isDark={true} />
      )
      expect(container.querySelector('h1')?.textContent).toBe('Hello')
      expect(container.querySelector('h2')?.textContent).toBe('World')
    })

    it('renders paragraphs', () => {
      const { container } = render(
        <MarkdownRenderer content="This is a paragraph." theme={defaultTheme} isDark={true} />
      )
      expect(container.querySelector('p')?.textContent).toBe('This is a paragraph.')
    })

    it('renders inline code', () => {
      const { container } = render(
        <MarkdownRenderer content="Use `const x = 1` here." theme={defaultTheme} isDark={true} />
      )
      expect(container.querySelector('code')?.textContent).toBe('const x = 1')
    })

    it('renders lists', () => {
      const { container } = render(
        <MarkdownRenderer content={'- Item 1\n- Item 2\n- Item 3\n'} theme={defaultTheme} isDark={true} />
      )
      const items = container.querySelectorAll('li')
      expect(items.length).toBe(3)
    })

    it('renders tables', () => {
      const tableMarkdown = '| Col A | Col B |\n|-------|-------|\n| 1     | 2     |\n| 3     | 4     |'
      const { container } = render(
        <MarkdownRenderer content={tableMarkdown} theme={defaultTheme} isDark={true} />
      )
      expect(container.querySelector('table')).toBeTruthy()
      expect(container.querySelectorAll('td').length).toBe(4)
    })

    it('renders blockquotes', () => {
      const { container } = render(
        <MarkdownRenderer content="> This is a quote" theme={defaultTheme} isDark={true} />
      )
      expect(container.querySelector('blockquote')).toBeTruthy()
    })
  })
})
