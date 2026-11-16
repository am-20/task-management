export type BlockType =
  | 'text'
  | 'h1'
  | 'h2'
  | 'h3'
  | 'bullet'
  | 'number'
  | 'todo'
  | 'quote'
  | 'callout'
  | 'divider'

export interface Block {
  id: string
  type: BlockType
  html: string
  checked?: boolean
  indent?: number
}

export interface Page {
  id: string
  areaId: string
  title: string
  icon: string
  blocks: Block[]
  createdAt: number
  updatedAt: number
}

export interface Area {
  id: string
  name: string
  icon: string
  color: string
  description: string
  createdAt: number
}

export interface Task {
  id: string
  title: string
  done: boolean
  doneAt?: number
  /** Local date key, YYYY-MM-DD */
  due?: string
  areaId?: string
  createdAt: number
}

export interface Habit {
  id: string
  name: string
  icon: string
  areaId?: string
  /** Date keys (YYYY-MM-DD) on which the habit was done */
  log: Record<string, boolean>
  createdAt: number
}

export interface DataSnapshot {
  areas: Area[]
  pages: Page[]
  tasks: Task[]
  habits: Habit[]
}
