// Module declarations for packages missing types
declare module 'katex/contrib/auto-render' {
  const renderMathInElement: (element: HTMLElement, options?: any) => void
  export default renderMathInElement
}

declare module 'emoji-dictionary' {
  const emojiDictionary: {
    getUnicode(name: string): string | undefined
    getName(emoji: string): string | undefined
  }
  export default emojiDictionary
}

// CSS modules
declare module '*.css' {
  const content: Record<string, string>
  export default content
}
