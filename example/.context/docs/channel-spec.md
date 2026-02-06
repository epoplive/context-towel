# Channel API Specification

## Protocol

The channel uses `window.postMessage` for cross-origin iframe communication.
For in-process embedding, a direct channel adapter skips serialization.

## Message Format

All messages are JSON objects with a `type` field:

```json
{ "type": "tree:update", "items": [...] }
```

## Tree Items

```typescript
interface TreeItem {
  id: string       // Relative path as identifier
  name: string     // Display name
  path: string     // Absolute filesystem path
  is_dir: boolean  // Directory flag
}
```

## Content Updates

Content is pushed as an array of path/content pairs:

```json
{
  "type": "content:update",
  "updates": [
    { "path": ".context/working/plan.md", "content": "# Plan\n..." }
  ]
}
```

## Graph Roots

Roots define the workspace directories the graph displays:

```typescript
interface GraphRoot {
  id: string       // Unique root identifier
  path: string     // Absolute path
  baseName: string // Display name (last path segment)
}
```

## Security

- Messages are validated for shape before processing
- File write requests require host-side authorization
- No direct filesystem access from the graph
