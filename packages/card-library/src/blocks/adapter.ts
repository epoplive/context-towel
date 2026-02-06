export function toJsonRuntime<T = unknown>(data: T): T {
  return JSON.parse(JSON.stringify(data)) as T
}
