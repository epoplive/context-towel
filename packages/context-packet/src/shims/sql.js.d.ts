// Type declarations for sql.js
// sql.js is a WASM build of SQLite that runs in JavaScript

declare module 'sql.js' {
  export interface QueryExecResult {
    columns: string[]
    values: unknown[][]
  }

  export interface SqlJsStatic {
    Database: new (data?: ArrayLike<number> | Buffer | null) => Database
  }

  export interface Database {
    run(sql: string, params?: unknown[]): Database
    exec(sql: string, params?: unknown[]): QueryExecResult[]
    export(): Uint8Array
    close(): void
  }

  export default function initSqlJs(config?: {
    locateFile?: (file: string) => string
  }): Promise<SqlJsStatic>
}
