export interface TocSectionData {
  title: string
  level: number
  children: TocSectionData[]
  counts?: {
    tasks: number
    tasksCompleted: number
    checklists: number
    checklistsCompleted: number
  }
}

export interface TocData {
  docName: string
  sections: TocSectionData[]
}
