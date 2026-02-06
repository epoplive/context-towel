export interface ChecklistGroupData {
  title: string
  items: ChecklistItemData[]
  progress: number
}

export interface ChecklistItemData {
  text: string
  checked: boolean
}
