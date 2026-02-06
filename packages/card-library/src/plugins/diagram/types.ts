export interface DiagramData {
  title: string
  code: string
  diagramType: string
}

export const diagramTypeColors: Record<string, string> = {
  'flowchart': '#3b82f6',
  'graph': '#3b82f6',
  'sequenceDiagram': '#8b5cf6',
  'classDiagram': '#ec4899',
  'stateDiagram': '#f97316',
  'erDiagram': '#14b8a6',
  'gantt': '#84cc16',
  'pie': '#f59e0b',
  'mindmap': '#06b6d4',
}
