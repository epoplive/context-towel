export type ColorTokenBlockData = {
  name: string
  value: string
  darkValue?: string
  role?: string  // primary, accent, background, surface, text, muted, border, success, warning, error
  group?: string  // brand, content, states, utility
  rationale?: string  // WHY this color was chosen
  contrastRatio?: string  // e.g., "7.2:1 on white" for accessibility
  wcag?: string  // AAA, AA, or fail
}
