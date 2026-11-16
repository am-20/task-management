import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { uid } from './lib/id'
import { sanitize } from './lib/sanitize'
import { AREA_COLORS, createSeed } from './seed'
import type { Area, Block, DataSnapshot, Habit, Page, Task } from './types'

interface State extends DataSnapshot {
  /** Areas whose page list is open in the sidebar */
  expanded: Record<string, boolean>
  sidebarOpen: boolean

  addArea: () => string
  updateArea: (id: string, patch: Partial<Area>) => void
  deleteArea: (id: string) => void

  addPage: (areaId: string) => string
  updatePage: (id: string, patch: Partial<Omit<Page, 'id' | 'blocks'>>) => void
  setBlocks: (id: string, blocks: Block[]) => void
  deletePage: (id: string) => void

  addTask: (task: { title: string; due?: string; areaId?: string }) => void
  updateTask: (id: string, patch: Partial<Task>) => void
  toggleTask: (id: string) => void
  deleteTask: (id: string) => void

  addHabit: (habit: { name: string; icon?: string; areaId?: string }) => void
  updateHabit: (id: string, patch: Partial<Habit>) => void
  toggleHabit: (id: string, dateKey: string) => void
  deleteHabit: (id: string) => void

  toggleExpanded: (id: string, open?: boolean) => void
  setSidebarOpen: (open: boolean) => void

  importData: (data: DataSnapshot) => void
  resetToSample: () => void
  clearAll: () => void
}

function normalizeSnapshot(raw: unknown): DataSnapshot {
  const data = (raw ?? {}) as Partial<DataSnapshot>
  const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])
  const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback)
  const areas = arr<Area>(data.areas)
    .filter((a) => a && typeof a.id === 'string')
    .map((a) => ({
      id: a.id,
      name: str(a.name, 'Untitled'),
      icon: str(a.icon, '🍂'),
      color: /^#[0-9a-f]{6}$/i.test(str(a.color)) ? a.color : AREA_COLORS[0].value,
      description: str(a.description),
      createdAt: Number(a.createdAt) || Date.now(),
    }))
  const areaIds = new Set(areas.map((a) => a.id))
  const pages = arr<Page>(data.pages)
    .filter((p) => p && typeof p.id === 'string' && areaIds.has(p.areaId))
    .map((p) => ({
      id: p.id,
      areaId: p.areaId,
      title: str(p.title),
      icon: str(p.icon, '📄'),
      blocks: arr<Block>(p.blocks)
        .filter((bl) => bl && typeof bl.id === 'string')
        .map((bl) => ({
          id: bl.id,
          type: bl.type,
          html: sanitize(str(bl.html)),
          checked: !!bl.checked,
          indent: Math.min(3, Math.max(0, Number(bl.indent) || 0)),
        })),
      createdAt: Number(p.createdAt) || Date.now(),
      updatedAt: Number(p.updatedAt) || Date.now(),
    }))
  const tasks = arr<Task>(data.tasks)
    .filter((t) => t && typeof t.id === 'string')
    .map((t) => ({
      id: t.id,
      title: str(t.title),
      done: !!t.done,
      doneAt: t.doneAt ? Number(t.doneAt) : undefined,
      due: /^\d{4}-\d{2}-\d{2}$/.test(str(t.due)) ? t.due : undefined,
      areaId: t.areaId && areaIds.has(t.areaId) ? t.areaId : undefined,
      createdAt: Number(t.createdAt) || Date.now(),
    }))
  const habits = arr<Habit>(data.habits)
    .filter((h) => h && typeof h.id === 'string')
    .map((h) => ({
      id: h.id,
      name: str(h.name, 'Habit'),
      icon: str(h.icon, '🍂'),
      areaId: h.areaId && areaIds.has(h.areaId) ? h.areaId : undefined,
      log: h.log && typeof h.log === 'object' ? { ...h.log } : {},
      createdAt: Number(h.createdAt) || Date.now(),
    }))
  return { areas, pages, tasks, habits }
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      ...createSeed(),
      expanded: {},
      sidebarOpen: true,

      addArea: () => {
        const id = uid()
        const color = AREA_COLORS[get().areas.length % AREA_COLORS.length].value
        set((s) => ({
          areas: [...s.areas, { id, name: '', icon: '🍂', color, description: '', createdAt: Date.now() }],
        }))
        return id
      },
      updateArea: (id, patch) =>
        set((s) => ({ areas: s.areas.map((a) => (a.id === id ? { ...a, ...patch } : a)) })),
      deleteArea: (id) =>
        set((s) => ({
          areas: s.areas.filter((a) => a.id !== id),
          pages: s.pages.filter((p) => p.areaId !== id),
          tasks: s.tasks.map((t) => (t.areaId === id ? { ...t, areaId: undefined } : t)),
          habits: s.habits.map((h) => (h.areaId === id ? { ...h, areaId: undefined } : h)),
        })),

      addPage: (areaId) => {
        const id = uid()
        const now = Date.now()
        set((s) => ({
          pages: [
            ...s.pages,
            {
              id,
              areaId,
              title: '',
              icon: '📄',
              blocks: [{ id: uid(), type: 'text', html: '' }],
              createdAt: now,
              updatedAt: now,
            },
          ],
          expanded: { ...s.expanded, [areaId]: true },
        }))
        return id
      },
      updatePage: (id, patch) =>
        set((s) => ({
          pages: s.pages.map((p) => (p.id === id ? { ...p, ...patch, updatedAt: Date.now() } : p)),
        })),
      setBlocks: (id, blocks) =>
        set((s) => ({
          pages: s.pages.map((p) => (p.id === id ? { ...p, blocks, updatedAt: Date.now() } : p)),
        })),
      deletePage: (id) => set((s) => ({ pages: s.pages.filter((p) => p.id !== id) })),

      addTask: ({ title, due, areaId }) => {
        const clean = title.trim()
        if (!clean) return
        set((s) => ({
          tasks: [...s.tasks, { id: uid(), title: clean, done: false, due, areaId, createdAt: Date.now() }],
        }))
      },
      updateTask: (id, patch) =>
        set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
      toggleTask: (id) =>
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === id ? { ...t, done: !t.done, doneAt: t.done ? undefined : Date.now() } : t,
          ),
        })),
      deleteTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),

      addHabit: ({ name, icon = '🍂', areaId }) => {
        const clean = name.trim()
        if (!clean) return
        set((s) => ({
          habits: [...s.habits, { id: uid(), name: clean, icon, areaId, log: {}, createdAt: Date.now() }],
        }))
      },
      updateHabit: (id, patch) =>
        set((s) => ({ habits: s.habits.map((h) => (h.id === id ? { ...h, ...patch } : h)) })),
      toggleHabit: (id, dateKey) =>
        set((s) => ({
          habits: s.habits.map((h) => {
            if (h.id !== id) return h
            const log = { ...h.log }
            if (log[dateKey]) delete log[dateKey]
            else log[dateKey] = true
            return { ...h, log }
          }),
        })),
      deleteHabit: (id) => set((s) => ({ habits: s.habits.filter((h) => h.id !== id) })),

      toggleExpanded: (id, open) =>
        set((s) => ({ expanded: { ...s.expanded, [id]: open ?? !s.expanded[id] } })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      importData: (data) => set({ ...normalizeSnapshot(data), expanded: {} }),
      resetToSample: () => set({ ...createSeed(), expanded: {} }),
      clearAll: () => set({ areas: [], pages: [], tasks: [], habits: [], expanded: {} }),
    }),
    {
      name: 'hearth-v1',
      version: 1,
      partialize: (s) => ({
        areas: s.areas,
        pages: s.pages,
        tasks: s.tasks,
        habits: s.habits,
        expanded: s.expanded,
        sidebarOpen: s.sidebarOpen,
      }),
    },
  ),
)

export function exportSnapshot(): DataSnapshot {
  const { areas, pages, tasks, habits } = useStore.getState()
  return { areas, pages, tasks, habits }
}

/** Consecutive days done, counting back from today (or yesterday if today is still open). */
export function habitStreak(habit: Habit, today: string, addDaysFn: (k: string, n: number) => string): number {
  let cursor = habit.log[today] ? today : addDaysFn(today, -1)
  let streak = 0
  while (habit.log[cursor]) {
    streak++
    cursor = addDaysFn(cursor, -1)
  }
  return streak
}
