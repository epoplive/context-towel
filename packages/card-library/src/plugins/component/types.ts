export type ComponentBlockData = {
  /** Component name */
  name: string
  /** Category: buttons, cards, badges, forms, navigation, panels, data, feedback, icons */
  category?: string
  /** Variant names */
  variants?: string[]
  /** Whether dark mode preview is included */
  darkMode?: boolean
  /** The actual code (Tailwind + HTML) */
  code?: string
  /** HTML preview content (rendered visually) */
  preview?: string
  /** Description of when/how to use this component */
  usage?: string
  /** Props/customization notes */
  props?: string[]
}
