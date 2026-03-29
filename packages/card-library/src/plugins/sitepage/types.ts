export type SitePageBlockData = {
  pageKey: string
  title: string
  slug?: string
  pageType?: string  // dashboard, form, detail, custom, gallery, settings
  priority?: 'must-have' | 'should-have' | 'nice-to-have'
  description?: string
  sections?: string[]
  parentKey?: string
  screenshotPath?: string
}
