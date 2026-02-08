export type FenceMarker = '`' | '~'

export type FencePreference = {
  preferredMarker?: FenceMarker
  minLength?: number
}

type Fence = {
  marker: FenceMarker
  length: number
}

function maxClosingFenceLength(body: string, marker: FenceMarker): number {
  const lines = body.split('\n')
  const re = marker === '`'
    ? /^ {0,3}(`+)\s*$/
    : /^ {0,3}(~+)\s*$/

  let max = 0
  for (const line of lines) {
    const match = line.match(re)
    if (!match) continue
    max = Math.max(max, match[1]?.length ?? 0)
  }
  return max
}

function chooseFence(body: string, preference: FencePreference = {}): Fence {
  const minLength = Math.max(3, preference.minLength ?? 3)
  const preferredMarker: FenceMarker = preference.preferredMarker ?? '`'

  const requiredBacktick = Math.max(minLength, maxClosingFenceLength(body, '`') + 1)
  const requiredTilde = Math.max(minLength, maxClosingFenceLength(body, '~') + 1)

  if (requiredBacktick < requiredTilde) return { marker: '`', length: requiredBacktick }
  if (requiredTilde < requiredBacktick) return { marker: '~', length: requiredTilde }
  return { marker: preferredMarker, length: requiredBacktick }
}

export function getFencePreferenceFromRaw(raw: string): FencePreference {
  // Preserve the author's fence choice when possible; upgrade/switch only when required.
  // Example open lines:
  // ```task
  // ~~~task
  // ````task
  const firstLine = raw.split('\n')[0] ?? ''
  const match = firstLine.match(/^\s{0,3}((?:`{3,})|(?:~{3,}))\s*/)
  if (!match) return {}

  const fence = match[1] ?? ''
  const marker = fence[0] === '~' ? '~' : '`'
  return {
    preferredMarker: marker,
    minLength: fence.length,
  }
}

export function formatFencedCodeBlock(lang: string, body: string, preference: FencePreference = {}): string {
  const normalizedBody = body.replace(/\r\n/g, '\n').trimEnd()
  const { marker, length } = chooseFence(normalizedBody, preference)
  const fence = marker.repeat(length)
  const info = lang ? lang.trim() : ''
  return `${fence}${info}\n${normalizedBody}\n${fence}`
}

