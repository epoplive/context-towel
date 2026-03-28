import { describe, it, expect } from 'vitest'
import { buildTocEntries, type TocEntry } from '../viewer/DocumentTOC'

describe('buildTocEntries', () => {
  it('parses headings with correct levels', () => {
    const content = '# Top\n\n## Sub\n\n### Deep\n\ntext\n'
    const entries = buildTocEntries(content)

    expect(entries).toHaveLength(3)
    expect(entries[0]).toMatchObject({ type: 'heading', text: 'Top', level: 1 })
    expect(entries[1]).toMatchObject({ type: 'heading', text: 'Sub', level: 2 })
    expect(entries[2]).toMatchObject({ type: 'heading', text: 'Deep', level: 3 })
  })

  it('parses task blocks with status', () => {
    const content = `# Plan

~~~task
id: t1
title: Build auth
status: in-progress
~~~

~~~task
id: t2
title: Write tests
status: done
~~~
`
    const entries = buildTocEntries(content)

    const tasks = entries.filter(e => e.type === 'task')
    expect(tasks).toHaveLength(2)
    expect(tasks[0]).toMatchObject({ text: 'Build auth', status: 'in-progress' })
    expect(tasks[1]).toMatchObject({ text: 'Write tests', status: 'done' })
  })

  it('parses question blocks with answered status', () => {
    const content = `# Design

~~~question
id: q1
---
What auth method should we use?
~~~

~~~question
id: q2
response: JWT with refresh tokens
---
What token strategy?
~~~
`
    const entries = buildTocEntries(content)

    const questions = entries.filter(e => e.type === 'question')
    expect(questions).toHaveLength(2)
    expect(questions[0]).toMatchObject({
      type: 'question',
      text: 'What auth method should we use?',
      answered: false,
    })
    expect(questions[1]).toMatchObject({
      type: 'question',
      text: 'What token strategy?',
      answered: true,
    })
  })

  it('sorts entries by document position', () => {
    const content = `# Top

~~~task
id: t1
title: First task
status: todo
~~~

## Middle

~~~question
id: q1
---
A question here?
~~~

## End
`
    const entries = buildTocEntries(content)

    expect(entries[0].text).toBe('Top')
    expect(entries[1].text).toBe('First task')
    expect(entries[2].text).toBe('Middle')
    expect(entries[3].text).toBe('A question here?')
    expect(entries[4].text).toBe('End')
  })

  it('excludes tasks when includeTasks=false', () => {
    const content = `# Doc\n\n~~~task\nid: t1\ntitle: Task\nstatus: todo\n~~~\n`
    const entries = buildTocEntries(content, { includeTasks: false })

    expect(entries.filter(e => e.type === 'task')).toHaveLength(0)
    expect(entries.filter(e => e.type === 'heading')).toHaveLength(1)
  })

  it('excludes questions when includeQuestions=false', () => {
    const content = `# Doc\n\n~~~question\nid: q1\n---\nQ?\n~~~\n`
    const entries = buildTocEntries(content, { includeQuestions: false })

    expect(entries.filter(e => e.type === 'question')).toHaveLength(0)
  })

  it('handles empty content', () => {
    expect(buildTocEntries('')).toEqual([])
  })

  it('handles content with no blocks', () => {
    const entries = buildTocEntries('# Just a heading\n\nSome text.\n')
    expect(entries).toHaveLength(1)
    expect(entries[0].type).toBe('heading')
  })

  it('counts open vs answered questions', () => {
    const content = `
~~~question
id: q1
---
Unanswered
~~~

~~~question
id: q2
response: Yes
---
Answered
~~~

~~~question
id: q3
answer: No
---
Also answered
~~~
`
    const entries = buildTocEntries(content)
    const questions = entries.filter(e => e.type === 'question')

    expect(questions).toHaveLength(3)
    expect(questions.filter(q => q.answered)).toHaveLength(2)
    expect(questions.filter(q => !q.answered)).toHaveLength(1)
  })
})
