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

export type RepeatUnit = 'day' | 'week' | 'month' | 'year'

/** How a task repeats. Each finished occurrence stays in history; the next one is a new task. */
export interface Repeat {
  /** Every N units */
  every: number
  unit: RepeatUnit
  /** Weekly: days of the week, 0 = Sunday … 6 = Saturday */
  weekdays?: number[]
  /** Monthly: on a date ('day') or on a weekday such as "the second Tuesday" ('weekday') */
  monthBy?: 'day' | 'weekday'
  /** Monthly by day: 1–31, or -1 for the last day of the month */
  monthDay?: number
  /** Monthly by weekday: 1–4 for first…fourth, or -1 for the last */
  nth?: number
  /** Monthly by weekday: 0 = Sunday … 6 = Saturday */
  weekday?: number
  /** Count the next date from when it was done rather than from the due date */
  fromCompletion?: boolean
  /** Stop after this date (YYYY-MM-DD) */
  until?: string
  /** Stop after this many occurrences */
  count?: number
  /** Which occurrence this is, starting at 1 */
  occurrence?: number
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
  repeat?: Repeat
  /** Shared by every occurrence of the same repeating task */
  seriesId?: string
  /** On a finished occurrence: the next occurrence it created, so un-ticking can undo it */
  spawnedId?: string
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
