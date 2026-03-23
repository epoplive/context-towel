import { $remark } from '@milkdown/utils'
import emojiDictionary from 'emoji-dictionary'

const EMOJI_SHORTCODE_REGEX = /:([a-z0-9_+-]+):/gi

function remarkEmojiShortcodes() {
  return (tree: any) => {
    const walk = (node: any) => {
      if (!node) return
      if (node.type === 'code' || node.type === 'inlineCode') return
      if (node.type === 'text' && typeof node.value === 'string' && node.value.includes(':')) {
        node.value = node.value.replace(EMOJI_SHORTCODE_REGEX, (match: string, name: string) => {
          const unicode = (emojiDictionary as any).getUnicode?.(name)
          return unicode ?? match
        })
      }
      if (Array.isArray(node.children)) node.children.forEach(walk)
    }
    walk(tree)
  }
}

export const remarkEmojiShortcodesPlugin = $remark('remarkEmojiShortcodes', () => remarkEmojiShortcodes)
