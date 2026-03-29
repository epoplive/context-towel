export type PatternBlockData = {
  name: string
  type?: string  // ui, ux, architecture, data_model, integration
  source?: string
  adaptation?: string
  priority?: 'high' | 'medium' | 'low'
  description?: string
}
