const WRAPPER_TAGS = [
  'INSTRUCTIONS',
  'environment_context',
  'turn_aborted',
  'collaboration_mode',
  'personality_spec',
  'model_switch',
] as const

const WRAPPER_TAG_PATTERN = WRAPPER_TAGS
  .map((t) => t.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'))
  .join('|')

// Wrapper tags are used for agent/system metadata and should not render as
// user-facing markdown. We only strip lines that consist solely of a wrapper
// tag, and we do it fence-aware so code samples remain intact.
const WRAPPER_TAG_LINE_RE = new RegExp(`^\\s*<\\/?\\s*(?:${WRAPPER_TAG_PATTERN})\\s*>\\s*$`, 'i')
const WRAPPER_TAG_INLINE_RE = new RegExp(`<\\/?\\s*(?:${WRAPPER_TAG_PATTERN})\\s*>`, 'gi')

// Some transcripts include pseudo-tags like: <image name=[Image #1]>
const IMAGE_TAG_LINE_RE = /^\s*<image\b[^>]*>\s*$/i

export function stripWrapperTagLines(markdown: string): string {
  if (!markdown) return markdown

  const normalized = markdown.replace(/\r\n/g, '\n')
  const lines = normalized.split('\n')

  let fence: { marker: '`' | '~'; len: number } | null = null
  const out: string[] = []

  for (const line of lines) {
    if (!fence) {
      const openMatch = line.match(/^ {0,3}([`~]{3,})/)
      if (openMatch) {
        const run = openMatch[1] ?? ''
        fence = { marker: run[0] === '~' ? '~' : '`', len: run.length }
        out.push(line)
        continue
      }

      if (WRAPPER_TAG_LINE_RE.test(line) || IMAGE_TAG_LINE_RE.test(line)) {
        continue
      }

      out.push(line)
      continue
    }

    // Inside a fenced code block: preserve wrapper tags verbatim.
    const closeRe = new RegExp(`^ {0,3}${fence.marker}{${fence.len},}\\s*$`)
    if (closeRe.test(line)) {
      fence = null
    }

    out.push(line)
  }

  return out.join('\n')
}

export function stripWrapperTagsInline(value: string): string {
  if (!value) return value
  return value.replace(WRAPPER_TAG_INLINE_RE, '')
}

export function stripHtmlComments(value: string): string {
  // Used for pagination heuristics; we treat HTML comments as invisible because
  // react-markdown will not render them without rehype-raw.
  return value.replace(/<!--[\s\S]*?-->/g, '')
}

export function stripInvisibleForPagination(markdown: string): string {
  return stripWrapperTagLines(stripHtmlComments(markdown))
}
