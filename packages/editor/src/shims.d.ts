declare module 'emoji-dictionary' {
  const emojiDictionary: {
    getUnicode(shortcode: string): string | undefined
  }
  export default emojiDictionary
}

declare module 'katex/contrib/auto-render' {
  type AutoRenderOptions = Record<string, unknown>
  export default function renderMathInElement(element: HTMLElement, options?: AutoRenderOptions): void
}
