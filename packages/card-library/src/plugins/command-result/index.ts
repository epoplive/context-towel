import { blockRegistry } from '../../blocks/registry'
import type { BlockDefinition } from '../../blocks/types'
import { CommandResultCard } from './CommandResultCard'
import type { CommandResultData } from './types'

export type { CommandResultData } from './types'
export { CommandResultCard } from './CommandResultCard'

export const commandResultBlockDefinition: BlockDefinition<CommandResultData> = {
  type: 'command-result',
  name: 'Command Result',
  schemaVersion: 1,
  components: {
    inline: CommandResultCard,
    card: CommandResultCard,
  },
}

export function registerCommandResultBlock(): void {
  if (!blockRegistry.has('command-result')) {
    blockRegistry.register(commandResultBlockDefinition as any)
  }
}
