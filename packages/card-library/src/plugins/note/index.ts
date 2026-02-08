import { blockRegistry } from '../../blocks/registry'
import type { BlockDefinition } from '../../blocks/types'
import { NoteCard } from './NoteCard'
import type { NoteData } from './types'

export type { NoteData } from './types'
export { noteTypeColors } from './types'
export { NoteCard } from './NoteCard'

/** Note block definition for the card library registry */
export const noteBlockDefinition: BlockDefinition<NoteData> = {
  type: 'note',
  name: 'Note',
  schemaVersion: 1,
  components: {
    inline: NoteCard,
    card: NoteCard,
  },
  toContextMarkdown(blocks) {
    const notes = blocks
      .filter((b) => b.data !== null)
      .map((b) => b.data!)

    if (notes.length === 0) return ''

    const lines: string[] = []
    for (const note of notes) {
      lines.push(`### ${note.title}`)
      lines.push(note.content)
      lines.push('')
    }

    return lines.join('\n')
  },
}

/** Register the note block plugin in the card library registry */
export function registerNoteBlock(): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  blockRegistry.registerOrReplace(noteBlockDefinition as any)
}
