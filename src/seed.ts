import { addDays, todayKey } from './lib/date'
import { uid } from './lib/id'
import type { Area, Block, BlockType, DataSnapshot, Habit, Page, Repeat, Task } from './types'

export const AREA_COLORS = [
  { name: 'Deep red', value: '#b33a32' },
  { name: 'Rust', value: '#c2622d' },
  { name: 'Ochre', value: '#d4a04a' },
  { name: 'Olive', value: '#8f9654' },
  { name: 'Pine', value: '#5a8a72' },
  { name: 'Teal', value: '#5d8791' },
  { name: 'Plum', value: '#8f5a7e' },
  { name: 'Clay', value: '#b9785f' },
]

const b = (type: BlockType, html = '', extra: Partial<Block> = {}): Block => ({
  id: uid(),
  type,
  html,
  ...extra,
})

export function createSeed(): DataSnapshot {
  const now = Date.now()
  const today = todayKey()
  const day = 86_400_000

  const area = (name: string, icon: string, color: string, description: string, i: number): Area => ({
    id: uid(),
    name,
    icon,
    color,
    description,
    createdAt: now + i,
  })

  const health = area('Health & Body', '🌿', '#8f9654', 'Sleep, movement, food and checkups.', 0)
  const money = area('Money', '🪙', '#d4a04a', 'Budget, bills and savings goals.', 1)
  const home = area('Home', '🏡', '#c2622d', 'Chores, repairs and making it cosy.', 2)
  const people = area('People', '🍷', '#b33a32', 'Family, friends and the dates that matter.', 3)
  const growth = area('Growth', '📚', '#8f5a7e', 'Reading, learning and reflection.', 4)
  const leisure = area('Leisure & Travel', '🧭', '#5d8791', 'Trips, hobbies and things to look forward to.', 5)

  const page = (areaId: string, title: string, icon: string, blocks: Block[], age: number): Page => ({
    id: uid(),
    areaId,
    title,
    icon,
    blocks,
    createdAt: now - age * day,
    updatedAt: now - age * day,
  })

  const pages: Page[] = [
    page(health.id, 'Weekly meal plan', '🥗', [
      b('callout', 'Cook twice, eat four times. Sunday and Wednesday are prep days.'),
      b('h2', 'This week'),
      b('bullet', '<b>Mon–Tue</b> · Roasted pumpkin soup, sourdough'),
      b('bullet', '<b>Wed–Thu</b> · Lentil ragù with pasta'),
      b('bullet', '<b>Fri</b> · Something out, no rules'),
      b('h2', 'Groceries'),
      b('todo', 'Pumpkin, carrots, onions', { checked: true }),
      b('todo', 'Red lentils, canned tomatoes'),
      b('todo', 'Oats, walnuts, apples'),
    ], 2),
    page(health.id, 'Checkups', '🩺', [
      b('text', 'A simple record so nothing gets forgotten.'),
      b('h3', 'Yearly'),
      b('todo', 'Dentist', { checked: false }),
      b('todo', 'Eye test', { checked: true }),
      b('todo', 'Blood work'),
    ], 9),
    page(money.id, 'Monthly budget', '📒', [
      b('quote', 'Give every euro a job before the month begins.'),
      b('h2', 'Fixed'),
      b('bullet', 'Rent and utilities'),
      b('bullet', 'Insurance, phone, internet'),
      b('h2', 'Flexible'),
      b('bullet', 'Groceries'),
      b('bullet', 'Eating out and fun'),
      b('divider'),
      b('h2', 'Savings goals'),
      b('number', 'Emergency fund — three months of expenses'),
      b('number', 'Spring trip'),
    ], 5),
    page(home.id, 'Cleaning rhythm', '🧺', [
      b('text', 'Small loops instead of one big Saturday.'),
      b('h3', 'Daily'),
      b('bullet', 'Dishes done before bed'),
      b('bullet', 'Ten-minute tidy'),
      b('h3', 'Weekly'),
      b('bullet', 'Laundry, bedding, floors'),
      b('bullet', 'Water the plants'),
    ], 12),
    page(people.id, 'Gift ideas', '🎁', [
      b('text', 'Write ideas down the moment someone mentions something.'),
      b('h3', 'Family'),
      b('bullet', 'Mum — the ceramic teapot from the market'),
      b('bullet', 'Dad — a good pair of gardening gloves'),
      b('h3', 'Friends'),
      b('bullet', ''),
    ], 3),
    page(growth.id, 'Reading list', '📖', [
      b('h2', 'Now reading'),
      b('todo', 'Four Thousand Weeks — Oliver Burkeman'),
      b('h2', 'Up next'),
      b('todo', 'The Remains of the Day — Kazuo Ishiguro'),
      b('todo', 'Braiding Sweetgrass — Robin Wall Kimmerer'),
      b('h2', 'Finished'),
      b('todo', 'Piranesi — Susanna Clarke', { checked: true }),
    ], 1),
    page(leisure.id, 'Trip ideas', '🗺️', [
      b('callout', 'One long weekend each season, booked a season ahead.'),
      b('h3', 'Someday'),
      b('bullet', 'A cabin in the mountains while the leaves turn'),
      b('bullet', 'Lisbon in early spring'),
      b('bullet', 'A slow train through the Alps'),
    ], 7),
  ]

  const task = (title: string, areaId: string | undefined, dueOffset: number | null, done = false, i = 0): Task => ({
    id: uid(),
    title,
    areaId,
    due: dueOffset === null ? undefined : addDays(today, dueOffset),
    done,
    doneAt: done ? now : undefined,
    createdAt: now - i * 1000,
  })

  const tasks: Task[] = [
    task('Book dentist appointment', health.id, -1, false, 1),
    task('Thirty-minute walk after lunch', health.id, 0, true, 2),
    task('Pay electricity bill', money.id, 0, false, 3),
    task('Water the plants', home.id, 0, false, 4),
    task('Call grandma', people.id, 0, false, 5),
    task('Meal prep for the week', health.id, 1, false, 6),
    task('Review subscriptions', money.id, 3, false, 7),
    task('Fix the kitchen shelf', home.id, 5, false, 8),
    task('Plan dinner with friends', people.id, 6, false, 9),
    task('Finish chapter four', growth.id, 2, false, 10),
    task('Renew passport', leisure.id, 14, false, 11),
    task('Sort the winter clothes', home.id, null, false, 12),
    task('Look into a pottery class', leisure.id, null, false, 13),
  ]

  // A few repeating tasks, so the calendar has something to show.
  const repeatTask = (title: string, repeat: Repeat) => {
    const t = tasks.find((x) => x.title === title)
    if (t) Object.assign(t, { repeat: { ...repeat, occurrence: 1 }, seriesId: t.id })
  }
  const todayDate = new Date()
  repeatTask('Water the plants', { every: 3, unit: 'day' })
  repeatTask('Pay electricity bill', { every: 1, unit: 'month', monthBy: 'day', monthDay: todayDate.getDate() })
  repeatTask('Call grandma', { every: 1, unit: 'week', weekdays: [todayDate.getDay()] })

  const habit = (name: string, icon: string, areaId: string | undefined, pattern: number[], i: number): Habit => ({
    id: uid(),
    name,
    icon,
    areaId,
    log: Object.fromEntries(pattern.map((offset) => [addDays(today, -offset), true])),
    createdAt: now + i,
  })

  const habits: Habit[] = [
    habit('Drink two litres of water', '💧', health.id, [0, 1, 2, 3, 4, 6, 7], 0),
    habit('Move for thirty minutes', '🏃', health.id, [0, 1, 3, 4, 5], 1),
    habit('Read twenty pages', '📖', growth.id, [1, 2, 3, 5, 6], 2),
    habit('Ten quiet minutes', '🕯️', growth.id, [1, 2, 4], 3),
    habit('In bed by eleven', '🌙', health.id, [1, 3, 4, 5, 6], 4),
  ]

  return { areas: [health, money, home, people, growth, leisure], pages, tasks, habits }
}
