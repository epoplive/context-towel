// Test harness for Playwright e2e tests.
// Renders PacketWorkspace with fixture data, no Tauri or file system needed.

import { ReactFlowProvider } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { ThemeProvider } from '../compat/design-system/ThemeProvider'
import { PacketWorkspace } from '../components/PacketWorkspace'

const FIXTURE_PACKET = `# Packet: e2e-test

## Whiteboard

### architecture

\`\`\`mermaid
graph TD
  Client --> AuthService --> TokenStore
  AuthService --> SessionDB
\`\`\`

## Problem Vectors

### primary [active]
- **Current:** Auth tokens expire silently, user gets 401 with no recovery path
- **Target:** Token refresh happens transparently, user never sees auth errors
- **Approach:** Intercept 401 responses, refresh token, retry original request

#### Solved Criteria
- [x] Token refresh endpoint exists (proven by fix-refresh-endpoint)
- [ ] 401 interceptor retries with new token
- [ ] Refresh failure redirects to login
- [!] Session persistence across tabs

#### Problem Facts
- [established] Tokens expire after 15 minutes
- [established] Refresh tokens last 7 days
- [gap] Unknown if WebSocket connections also need token refresh

## AICCL

~~~node
id: investigate-auth
state: active
---
Auth tokens expire after 15 minutes. The client has no refresh logic.
When a 401 comes back, the user sees a generic error page.
Need to add an HTTP interceptor that catches 401 and refreshes.
~~~

~~~node
id: fix-refresh-endpoint
state: success
---
Added POST /auth/refresh that accepts refresh token and returns new access token.
Validated against session DB to prevent replay attacks.
~~~

~~~node
id: ref-auth-docs
state: active
type: reference
path: /docs/architecture/auth.md
edges: investigate-auth
---
Auth architecture documentation — describes token lifecycle
~~~

~~~node
id: test-auth-refresh
state: success
type: test
path: packages/auth/test/refresh.spec.ts
edges: investigate-auth, fix-refresh-endpoint
---
Tests for the refresh endpoint — 12 passing
~~~

~~~node
id: test-interceptor
state: failed
type: test
path: packages/auth/test/interceptor.spec.ts
edges: investigate-auth
---
Interceptor tests — 3 passed, 2 failed: timeout on retry logic
~~~

~~~node
id: diag-token-flow
state: active
type: diagram
edges: investigate-auth
---
sequenceDiagram
  Client->>API: Request (expired token)
  API-->>Client: 401 Unauthorized
  Client->>Auth: POST /refresh
  Auth-->>Client: New access token
  Client->>API: Retry original request
  API-->>Client: 200 OK
~~~

## Delta Log

- \`2026-03-25 14:30:00\` **discovery** [investigate-auth]: Found tokens expire after 15 min with no client-side refresh
- \`2026-03-25 15:00:00\` **discovery** [investigate-auth]: HTTP interceptor pattern identified as solution
- \`2026-03-25 15:30:00\` **success** [fix-refresh-endpoint]: Implemented and tested refresh endpoint
- \`2026-03-25 16:00:00\` **mutation** [investigate-auth]: Updated investigation with interceptor approach details

## Linked

- Plan: \`.context/working/PLAN-auth-refresh.md\`
`

export function TestHarness() {
  return (
    <ThemeProvider>
      <div style={{ width: '100vw', height: '100vh', background: '#0d0d1a' }}>
        <div style={{
          padding: '8px 16px',
          borderBottom: '1px solid #2a2a4a',
          fontSize: 13,
          color: '#e0e0e0',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}>
          <strong>Packet Workspace — E2E Test Harness</strong>
          <span data-testid="harness-ready" style={{ color: '#4a9' }}>Ready</span>
        </div>
        <div style={{ flex: 1, height: 'calc(100vh - 40px)', position: 'relative' }}>
          <ReactFlowProvider>
            <PacketWorkspace
              packetContent={FIXTURE_PACKET}
              packetName="e2e-test"
              packetPath="/test/.context/packets/active/e2e-test.md"
            />
          </ReactFlowProvider>
        </div>
      </div>
    </ThemeProvider>
  )
}
