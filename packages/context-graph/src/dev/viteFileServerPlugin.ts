/// <reference types="node" />
/**
 * Vite dev server plugin that serves a real project directory
 * as API endpoints for the context graph dev app.
 *
 * Endpoints:
 *   GET /api/tree   → TreeItem[] (recursive file listing)
 *   GET /api/file?path=<relative-path> → { content: string }
 */

import fs from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'

interface FileTreeItem {
  id: string
  name: string
  path: string
  is_dir: boolean
}

function walkDir(dir: string, rootDir: string): FileTreeItem[] {
  const items: FileTreeItem[] = []

  function recurse(currentDir: string) {
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true })
    } catch {
      return
    }

    // Sort: directories first, then alphabetically
    entries.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1
      if (!a.isDirectory() && b.isDirectory()) return 1
      return a.name.localeCompare(b.name)
    })

    for (const entry of entries) {
      // Skip hidden files (except .context), node_modules, etc.
      if (entry.name.startsWith('.') && entry.name !== '.context') continue
      if (entry.name === 'node_modules' || entry.name === 'dist') continue

      const fullPath = path.join(currentDir, entry.name)
      const relativePath = path.relative(rootDir, fullPath)
      const isDir = entry.isDirectory()

      items.push({
        id: relativePath,
        name: entry.name,
        path: fullPath,
        is_dir: isDir,
      })

      if (isDir) {
        recurse(fullPath)
      }
    }
  }

  recurse(dir)
  return items
}

export function fileServerPlugin(projectDir: string): Plugin {
  const resolvedDir = path.resolve(projectDir)

  return {
    name: 'context-towel-file-server',

    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url!, `http://${req.headers.host}`)

        if (url.pathname === '/api/tree') {
          const items = walkDir(resolvedDir, resolvedDir)
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(items))
          return
        }

        if (url.pathname === '/api/file') {
          const filePath = url.searchParams.get('path')
          if (!filePath) {
            res.statusCode = 400
            res.end(JSON.stringify({ error: 'Missing path parameter' }))
            return
          }

          const fullPath = path.join(resolvedDir, filePath)

          // Security: ensure the resolved path is inside projectDir
          if (!fullPath.startsWith(resolvedDir)) {
            res.statusCode = 403
            res.end(JSON.stringify({ error: 'Path outside project directory' }))
            return
          }

          try {
            const content = fs.readFileSync(fullPath, 'utf-8')
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ content }))
          } catch {
            res.statusCode = 404
            res.end(JSON.stringify({ error: 'File not found' }))
          }
          return
        }

        if (url.pathname === '/api/roots') {
          // Return the .context directory as the graph root
          const contextDir = path.join(resolvedDir, '.context')
          const hasContext = fs.existsSync(contextDir)
          const roots = hasContext
            ? [{ id: '.context', path: contextDir, baseName: '.context' }]
            : [{ id: path.basename(resolvedDir), path: resolvedDir, baseName: path.basename(resolvedDir) }]
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(roots))
          return
        }

        next()
      })
    },
  }
}
