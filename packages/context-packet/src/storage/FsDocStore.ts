/**
 * FsDocStore — filesystem-backed document artifact storage.
 *
 * Stores artifacts as files inside the packet directory.
 * Excludes structured docs (packet.md, workflow.md, lessons.md).
 */

import type { FileService } from '../types'
import type { DocStore } from './DocStore'

const STRUCTURED_DOCS = new Set(['packet.md', 'workflow.md', 'lessons.md'])

export class FsDocStore implements DocStore {
  constructor(
    private fs: FileService,
    private contextDir: string,
  ) {}

  private getFullPath(packetName: string, docPath: string): string {
    return `${this.contextDir}/packets/active/${packetName}/${docPath}`
  }

  private getPacketDir(packetName: string): string {
    return `${this.contextDir}/packets/active/${packetName}`
  }

  async read(packetName: string, docPath: string): Promise<string> {
    return this.fs.read(this.getFullPath(packetName, docPath))
  }

  async write(packetName: string, docPath: string, content: string): Promise<void> {
    const fullPath = this.getFullPath(packetName, docPath)
    const dir = fullPath.substring(0, fullPath.lastIndexOf('/'))
    await this.fs.mkdir(dir)
    await this.fs.write(fullPath, content)
  }

  async exists(packetName: string, docPath: string): Promise<boolean> {
    return this.fs.exists(this.getFullPath(packetName, docPath))
  }

  async remove(packetName: string, docPath: string): Promise<void> {
    return this.fs.remove(this.getFullPath(packetName, docPath))
  }

  async list(packetName: string): Promise<string[]> {
    const packetDir = this.getPacketDir(packetName)
    const results: string[] = []
    await this.walkDir(packetDir, packetDir, results)
    return results
  }

  private async walkDir(dir: string, base: string, results: string[]): Promise<void> {
    try {
      const entries = await this.fs.list(dir)
      for (const entry of entries) {
        const relativePath = entry.path.startsWith(base + '/')
          ? entry.path.slice(base.length + 1)
          : entry.name

        if (entry.is_dir) {
          await this.walkDir(entry.path, base, results)
        } else if (!STRUCTURED_DOCS.has(relativePath) && !STRUCTURED_DOCS.has(entry.name)) {
          results.push(relativePath)
        }
      }
    } catch {
      // Directory doesn't exist
    }
  }
}
