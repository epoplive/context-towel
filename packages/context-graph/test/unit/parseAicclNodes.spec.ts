import { describe, it, expect } from 'vitest'
import { parseAicclNodes, parsePacketSections } from '../../src/components/packet/parsePacketContent'
// Types used implicitly via parseAicclNodes return type

function sectionsFrom(markdown: string) {
  return parsePacketSections(markdown)
}

describe('parseAicclNodes', () => {
  it('parses a basic work node', () => {
    const md = `## Nodes

~~~node
id: auth-work
state: active
---
Investigating authentication flow
~~~
`
    const { nodes, edges } = parseAicclNodes(sectionsFrom(md))
    expect(nodes).toHaveLength(1)
    expect(nodes[0].id).toBe('auth-work')
    expect(nodes[0].state).toBe('active')
    expect(nodes[0].type).toBe('work')
    expect(nodes[0].body).toBe('Investigating authentication flow')
    expect(nodes[0].edges).toEqual([])
    expect(edges).toHaveLength(0)
  })

  it('parses typed nodes (reference, test, diagram)', () => {
    const md = `## Nodes

~~~node
id: ref-auth-docs
state: active
type: reference
path: /docs/auth.md
---
Auth architecture documentation
~~~

~~~node
id: test-auth
state: active
type: test
path: tests/auth.spec.ts
---
Auth unit tests
~~~

~~~node
id: diag-flow
state: active
type: diagram
---
graph TD
  Login --> Token --> API
~~~
`
    const { nodes } = parseAicclNodes(sectionsFrom(md))
    expect(nodes).toHaveLength(3)

    expect(nodes[0].type).toBe('reference')
    expect(nodes[0].path).toBe('/docs/auth.md')

    expect(nodes[1].type).toBe('test')
    expect(nodes[1].path).toBe('tests/auth.spec.ts')

    expect(nodes[2].type).toBe('diagram')
    expect(nodes[2].body).toContain('graph TD')
  })

  it('parses edges from edges field', () => {
    const md = `## Nodes

~~~node
id: ref-docs
state: active
type: reference
path: /docs/auth.md
edges: auth-work, session-work
---
Auth docs
~~~

~~~node
id: auth-work
state: active
---
Working on auth
~~~
`
    const { nodes, edges } = parseAicclNodes(sectionsFrom(md))
    expect(nodes).toHaveLength(2)

    // ref-docs has 2 edges
    expect(nodes[0].edges).toEqual(['auth-work', 'session-work'])

    // Edge entries created for each connection
    expect(edges).toHaveLength(2)
    expect(edges[0]).toEqual({ source: 'ref-docs', target: 'auth-work' })
    expect(edges[1]).toEqual({ source: 'ref-docs', target: 'session-work' })
  })

  it('defaults unknown type to work', () => {
    const md = `## Nodes

~~~node
id: some-node
state: active
type: banana
---
Unknown type
~~~
`
    const { nodes } = parseAicclNodes(sectionsFrom(md))
    expect(nodes[0].type).toBe('work')
  })

  it('defaults missing type to work', () => {
    const md = `## Nodes

~~~node
id: bare-node
state: active
---
No type field
~~~
`
    const { nodes } = parseAicclNodes(sectionsFrom(md))
    expect(nodes[0].type).toBe('work')
  })

  it('defaults missing state to active', () => {
    const md = `## Nodes

~~~node
id: no-state
---
Missing state field
~~~
`
    const { nodes } = parseAicclNodes(sectionsFrom(md))
    expect(nodes[0].state).toBe('active')
  })

  it('skips blocks without id', () => {
    const md = `## Nodes

~~~node
state: active
---
No id field
~~~

~~~node
id: valid
state: active
---
Has id
~~~
`
    const { nodes } = parseAicclNodes(sectionsFrom(md))
    expect(nodes).toHaveLength(1)
    expect(nodes[0].id).toBe('valid')
  })

  it('returns empty for missing Nodes section', () => {
    const md = `## Whiteboard

Some content
`
    const { nodes, edges } = parseAicclNodes(sectionsFrom(md))
    expect(nodes).toEqual([])
    expect(edges).toEqual([])
  })

  it('parses node without body (no --- separator)', () => {
    const md = `## Nodes

~~~node
id: header-only
state: done
type: reference
path: /foo.md
~~~
`
    const { nodes } = parseAicclNodes(sectionsFrom(md))
    expect(nodes).toHaveLength(1)
    expect(nodes[0].id).toBe('header-only')
    expect(nodes[0].body).toBe('')
  })

  it('parses optional layer and subsystem fields', () => {
    const md = `## Nodes

~~~node
id: layered-node
state: active
layer: core
subsystem: auth
---
Body content
~~~
`
    const { nodes } = parseAicclNodes(sectionsFrom(md))
    expect(nodes[0].layer).toBe('core')
    expect(nodes[0].subsystem).toBe('auth')
  })

  it('handles multiple nodes with complex edge graph', () => {
    const md = `## Nodes

~~~node
id: work-1
state: active
---
First work node
~~~

~~~node
id: work-2
state: active
---
Second work node
~~~

~~~node
id: ref-shared
state: active
type: reference
path: /shared.md
edges: work-1, work-2
---
Referenced by both
~~~

~~~node
id: test-1
state: active
type: test
path: tests/one.spec.ts
edges: work-1
---
Test for work-1
~~~
`
    const { nodes, edges } = parseAicclNodes(sectionsFrom(md))
    expect(nodes).toHaveLength(4)
    expect(edges).toHaveLength(3) // ref-shared→work-1, ref-shared→work-2, test-1→work-1
  })

  it('handles empty edges field gracefully', () => {
    const md = `## Nodes

~~~node
id: isolated
state: active
edges:
---
No connections
~~~
`
    const { nodes, edges } = parseAicclNodes(sectionsFrom(md))
    // edges field is empty string after "edges:" — should not create edge entries
    // The parser requires value after colon, so 'edges' field won't be set
    expect(nodes).toHaveLength(1)
    expect(nodes[0].edges).toEqual([])
    expect(edges).toHaveLength(0)
  })
})
