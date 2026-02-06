# Architecture

## Package Structure

```
context-towel/
  packages/
    card-library/     # Shared markdown block rendering
    context-graph/    # React Flow graph application
```

## Card Library

Shared markdown rendering with typed block plugins.

### Block Plugin Interface

Each block type registers:
- **type**: Unique string identifier (e.g. `task`, `checklist`, `diagram`)
- **parse**: Extract structured data from markdown fenced blocks
- **render**: React component for visual display
- **toContextMarkdown**: Generate instruction file content

### Block Registry

Central registry manages all block types. Plugins self-register on import.
The registry supports hot-reload for development.

## Context Graph

React Flow-based graph for navigating project context files.

### Node Types
- **Folder nodes**: Represent directories, collapsible
- **Document nodes**: Render markdown content with block plugins
- **Widget nodes**: Special-purpose displays (task boards, diagrams)

### Layout Engine
- Dagre-based automatic layout
- Manual position overrides persisted per-node
- Focus mode constrains visible subgraph

## Channel API

PostMessage protocol for host-to-graph communication.

### Inbound (host -> graph)
| Message | Purpose |
|---------|---------|
| `tree:update` | Push file tree structure |
| `content:update` | Push file contents |
| `focus:set` | Set focused file/line |
| `settings:update` | Update project settings |
| `roots:set` | Set workspace roots |

### Outbound (graph -> host)
| Message | Purpose |
|---------|---------|
| `file:open` | Request host open a file |
| `file:write` | Request host write content |
| `node:select` | Notify host of node selection |
| `context:update` | Push context snapshot |

## Design Principles

1. **Zero host dependencies** - Graph never touches filesystem directly
2. **Channel-first** - All data flows through the channel API
3. **Plugin architecture** - Block types are extensible
4. **Theme tokens** - Host controls visual appearance
