// Ambient type shim for @tauri-apps/plugin-shell.
// The real module is a peer dependency resolved at runtime in Tauri apps.
// This shim satisfies tsc when plugin-shell is not installed in this workspace.
declare module '@tauri-apps/plugin-shell' {
  export function open(path: string): Promise<void>
}
