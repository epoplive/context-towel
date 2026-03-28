/**
 * DocStore — abstraction for packet document artifact storage.
 *
 * FsDocStore stores artifacts as files in the packet directory.
 * PgDocStore would store them in a Postgres table.
 * PacketEngine uses DocStore instead of FileService for artifact CRUD.
 */

export interface DocStore {
  /** Read a document's content */
  read(packetName: string, docPath: string): Promise<string>

  /** Write a document */
  write(packetName: string, docPath: string, content: string): Promise<void>

  /** Check if a document exists */
  exists(packetName: string, docPath: string): Promise<boolean>

  /** Remove a document */
  remove(packetName: string, docPath: string): Promise<void>

  /** List all documents in a packet (relative paths) */
  list(packetName: string): Promise<string[]>
}
