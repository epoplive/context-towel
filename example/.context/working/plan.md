# Context Towel - Development Plan

## Overview
Build a standalone context graph + card library that any IDE or tool can embed.

---

```task
id: card-library-core
title: Build card library core
status: in-progress
priority: high
tags: #cards #core
description: |
  Build the shared card rendering library with typed block plugins,
  AST pipeline, and theming support.
checklist:
  - [x] Set up package structure
  - [x] Define block plugin interface
  - [x] Implement block registry
  - [ ] Implement task block renderer
  - [ ] Implement checklist block renderer
  - [ ] Add theme token system
```

```task
id: context-graph-standalone
title: Port context graph to standalone
status: in-progress
priority: high
tags: #graph #migration
blocked-by: [[card-library-core]]
description: |
  Extract the context graph from Looking Glass into a standalone
  package with zero LG dependencies.
checklist:
  - [x] Copy FlowNodes and graph components
  - [x] Create compat layer for LG services
  - [x] Cut all LG imports
  - [ ] Wire channel API for host communication
  - [ ] Replace compat stubs with real implementations
```

```task
id: channel-api-integration
title: Wire channel API end-to-end
status: todo
priority: high
tags: #channel #api
blocked-by: [[context-graph-standalone]]
description: |
  Connect the channel API so hosts can push file tree and content
  updates into the graph, and receive events back.
checklist:
  - [ ] Implement host-side file watcher
  - [ ] Stream tree updates on file changes
  - [ ] Stream content updates on save
  - [ ] Handle outbound events (file:open, node:select)
```

```task
id: felix-integration
title: Integrate into Felix
status: todo
priority: medium
tags: #felix #integration
blocked-by: [[card-library-core]]
blocked-by: [[channel-api-integration]]
description: |
  Embed the context graph into Felix via iframe + channel API.
  Use card library for chat message rendering.
```

## Decisions

- **Block format**: Fenced code blocks with YAML front matter
- **Channel protocol**: PostMessage-based, bidirectional
- **State management**: Zustand with subscribeWithSelector
- **Graph renderer**: React Flow (@xyflow/react)
