import { blockRegistry } from '../../blocks/registry'
import type { BlockDefinition } from '../../blocks/types'
import { QuestionCard } from './QuestionCard'
import type { QuestionBlockData } from './types'

export type { QuestionBlockData, QuestionOption, Question } from './types'
export { QuestionCard } from './QuestionCard'

/** Question block definition for the card library registry */
export const questionBlockDefinition: BlockDefinition<QuestionBlockData> = {
  type: 'question',
  name: 'Question',
  schemaVersion: 1,
  components: {
    inline: QuestionCard,
    card: QuestionCard,
  },
  toContextMarkdown(blocks) {
    const questions = blocks
      .filter((b) => b.data !== null)
      .map((b) => b.data!)
    if (questions.length === 0) return ''
    const lines: string[] = []
    for (const q of questions) {
      if (q.title) lines.push(`### ${q.title}`)
      if (q.text) lines.push(`**Q:** ${q.text}`)
      if (q.responses) {
        lines.push('**Responses:**')
        for (const [key, val] of Object.entries(q.responses)) {
          lines.push(`- ${key}: ${val}`)
        }
      }
      lines.push('')
    }
    return lines.join('\n')
  },
}

/** Register the question block plugin in the card library registry */
export function registerQuestionBlock(): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  blockRegistry.registerOrReplace(questionBlockDefinition as any)
}
