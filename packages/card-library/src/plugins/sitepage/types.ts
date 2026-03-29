export type SitePageBlockData = {
  pageKey: string
  title: string
  slug?: string
  pageType?: string  // dashboard, form, detail, custom, gallery, settings, auth, error
  priority?: 'must-have' | 'should-have' | 'nice-to-have'
  description?: string
  sections?: string[]
  features?: string[]
  dataRequirements?: string[]
  parentKey?: string
  screenshotPath?: string
}
