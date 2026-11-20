import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { todayKey } from './lib/date'
import { uid } from './lib/id'
import { cleanRepeat, firstOnOrAfter, nextDue } from './lib/repeat'
import { sanitize } from './lib/sanitize'
import { AREA_COLORS, createSeed } from './seed'
import type { Area, Block, DataSnapshot, Habit, Page, Repeat, Step, Task } from './types'

interface State extends DataSnapshot {
  /** Areas whose page list is open in the sidebar */
  expanded: Record<string, boolean>
  sidebarOpen: boolean
  /** Week view on a phone: time columns or a list per day (this device only) */
  weekLayout: 'columns' | 'list'

  addArea: () => string
  updateArea: (id: string, patch: Partial<Area>) => void
  deleteArea: (id: string) => void

  addPage: (areaId: string) => string
  updatePage: (id: string, patch: Partial<Omit<Page, 'id' | 'blocks'>>) => void
  setBlocks: (id: string, blocks: Block[]) => void
  deletePage: (id: string) => void

  addTask: (task: { title: string; due?: string; time?: string; duration?: number; areaId?: string; repeat?: Repeat }) => void
  updateTask: (id: string, patch: Partial<Task>) => void
  toggleTask: (id: string) => void
  /** Set or clear how a task repeats */
  setRepeat: (id: string, repeat?: Repeat) => void
  /** Move a repeating task to its next date without marking it done */
  skipOccurrence: (id: string) => void

  /** Add a step to a task (after another step, or at the end); returns its id */
  addStep: (taskId: string, title?: string, afterId?: string) => string
  updateStep: (taskId: string, stepId: string, patch: Partial<Step>) => void
  toggleStep: (taskId: string, stepId: string) => void
  deleteStep: (taskId: string, stepId: string) => void
  moveStep: (taskId: string, stepId: string, by: -1 | 1) => void
  /** Put a step at a position in the list (drag to reorder) */
  reorderStep: (taskId: string, stepId: string, toIndex: number) => void
  deleteTask: (id: string) => void
  /** Put a deleted task back where it was (for Undo) */
  restoreTask: (task: Task, index: number) => void

  addHabit: (habit: { name: string; icon?: string; areaId?: string }) => void
  updateHabit: (id: string, patch: Partial<Habit>) => void
  toggleHabit: (id: string, dateKey: string) => void
  deleteHabit: (id: string) => void

  toggleExpanded: (id: string, open?: boolean) => void
  setSidebarOpen: (open: boolean) => void
  setWeekLayout: (layout: 'columns' | 'list') => void

  importData: (data: DataSnapshot) => void
  /** Replace the data with a copy from the cloud, keeping UI state such as open folders */
  applyRemote: (data: DataSnapshot) => void
  resetToSample: () => void
  clearAll: () => void
}

export function normalizeSnapshot(raw: unknown): DataSnapshot {
  const data = (raw ?? {}) as Partial<DataSnapshot>
  const arr = <T,>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : [])
  const str = (v: unknown, fallback = '') => (typeof v === 'string' ? v : fallback)
  // Keep fields this version doesn't know about, so an older copy of the app
  // open on another device never erases data saved by a newer one.
  const keep = (o: object): Record<string, unknown> => ({ ...o })
  const areas = arr<Area>(data.areas)
    .filter((a) => a && typeof a.id === 'string')
    .map((a) => ({
      ...keep(a),
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
      ...keep(p),
      id: p.id,
      areaId: p.areaId,
      title: str(p.title),
      icon: str(p.icon, '📄'),
      blocks: arr<Block>(p.blocks)
        .filter((bl) => bl && typeof bl.id === 'string')
        .map((bl) => ({
          ...keep(bl),
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
      ...keep(t),
      id: t.id,
      title: str(t.title),
      done: !!t.done,
      doneAt: t.doneAt ? Number(t.doneAt) : undefined,
      due: /^\d{4}-\d{2}-\d{2}$/.test(str(t.due)) ? t.due : undefined,
      time: /^([01]\d|2[0-3]):[0-5]\d$/.test(str(t.time)) ? t.time : undefined,
      duration: Number.isInteger(t.duration) && t.duration! >= 5 && t.duration! <= 1440 ? t.duration : undefined,
      areaId: t.areaId && areaIds.has(t.areaId) ? t.areaId : undefined,
      repeat: cleanRepeat(t.repeat),
      seriesId: typeof t.seriesId === 'string' ? t.seriesId : undefined,
      spawnedId: typeof t.spawnedId === 'string' ? t.spawnedId : undefined,
      steps: Array.isArray(t.steps)
        ? t.steps
            .filter((st) => st && typeof st.id === 'string')
            .map((st) => ({ ...keep(st), id: st.id, title: str(st.title), done: !!st.done }))
        : undefined,
      note: typeof t.note === 'string' ? t.note : undefined,
      createdAt: Number(t.createdAt) || Date.now(),
    }))
  const habits = arr<Habit>(data.habits)
    .filter((h) => h && typeof h.id === 'string')
    .map((h) => ({
      ...keep(h),
      id: h.id,
      name: str(h.name, 'Habit'),
      icon: str(h.icon, '🍂'),
      areaId: h.areaId && areaIds.has(h.areaId) ? h.areaId : undefined,
      log: h.log && typeof h.log === 'object' ? { ...h.log } : {},
      days: Array.isArray(h.days)
        ? [...new Set(h.days.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))]
        : undefined,
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
      weekLayout: 'columns',

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

      addTask: ({ title, due, time, duration, areaId, repeat }) => {
        const clean = title.trim()
        if (!clean) return
        const id = uid()
        const task: Task = repeat
          ? {
              id,
              title: clean,
              done: false,
              due: firstOnOrAfter(repeat, due ?? todayKey()),
              time,
              duration,
              areaId,
              createdAt: Date.now(),
              repeat: { ...repeat, occurrence: 1 },
              seriesId: id,
            }
          : { id, title: clean, done: false, due, time: due ? time : undefined, duration: due ? duration : undefined, areaId, createdAt: Date.now() }
        set((s) => ({ tasks: [...s.tasks, task] }))
      },
      updateTask: (id, patch) =>
        set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) })),
      toggleTask: (id) =>
        set((s) => {
          const task = s.tasks.find((t) => t.id === id)
          if (!task) return {}
          const now = Date.now()

          if (task.done) {
            // Un-ticking: also take back the next occurrence it created, if that one is still open.
            const spawned = task.spawnedId ? s.tasks.find((t) => t.id === task.spawnedId) : undefined
            const removeSpawned = !!spawned && !spawned.done
            return {
              tasks: s.tasks
                .filter((t) => !(removeSpawned && t.id === spawned.id))
                .map((t) =>
                  t.id === id
                    ? { ...t, done: false, doneAt: undefined, spawnedId: removeSpawned ? undefined : t.spawnedId }
                    : t,
                ),
            }
          }

          // Finishing a repeating task keeps this one as history and creates the next.
          if (task.repeat && !task.spawnedId) {
            const next = nextDue(task.repeat, task.due ?? todayKey(), todayKey())
            if (next) {
              const nextTask: Task = {
                id: uid(),
                title: task.title,
                done: false,
                due: next,
                time: task.time,
                duration: task.duration,
                // Each time round, the steps start again from the top.
                steps: task.steps?.map((st) => ({ ...st, id: uid(), done: false })),
                note: task.note,
                areaId: task.areaId,
                createdAt: now,
                repeat: { ...task.repeat, occurrence: (task.repeat.occurrence ?? 1) + 1 },
                seriesId: task.seriesId ?? task.id,
              }
              return {
                tasks: [
                  ...s.tasks.map((t) =>
                    t.id === id
                      ? { ...t, done: true, doneAt: now, seriesId: t.seriesId ?? t.id, spawnedId: nextTask.id }
                      : t,
                  ),
                  nextTask,
                ],
              }
            }
          }
          return { tasks: s.tasks.map((t) => (t.id === id ? { ...t, done: true, doneAt: now } : t)) }
        }),
      setRepeat: (id, repeat) =>
        set((s) => ({
          tasks: s.tasks.map((t) => {
            if (t.id !== id) return t
            if (!repeat) return { ...t, repeat: undefined }
            return {
              ...t,
              repeat: { ...repeat, occurrence: t.repeat?.occurrence ?? 1 },
              due: firstOnOrAfter(repeat, t.due ?? todayKey()),
              seriesId: t.seriesId ?? t.id,
            }
          }),
        })),
      addStep: (taskId, title = '', afterId) => {
        const id = uid()
        set((s) => ({
          tasks: s.tasks.map((t) => {
            if (t.id !== taskId) return t
            const steps = [...(t.steps ?? [])]
            const at = afterId ? steps.findIndex((st) => st.id === afterId) + 1 : steps.length
            steps.splice(at <= 0 ? steps.length : at, 0, { id, title, done: false })
            return { ...t, steps }
          }),
        }))
        return id
      },
      updateStep: (taskId, stepId, patch) =>
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === taskId ? { ...t, steps: t.steps?.map((st) => (st.id === stepId ? { ...st, ...patch } : st)) } : t,
          ),
        })),
      toggleStep: (taskId, stepId) =>
        set((s) => ({
          tasks: s.tasks.map((t) =>
            t.id === taskId ? { ...t, steps: t.steps?.map((st) => (st.id === stepId ? { ...st, done: !st.done } : st)) } : t,
          ),
        })),
      deleteStep: (taskId, stepId) =>
        set((s) => ({
          tasks: s.tasks.map((t) => {
            if (t.id !== taskId) return t
            const steps = t.steps?.filter((st) => st.id !== stepId)
            return { ...t, steps: steps && steps.length ? steps : undefined }
          }),
        })),
      moveStep: (taskId, stepId, by) =>
        set((s) => ({
          tasks: s.tasks.map((t) => {
            if (t.id !== taskId || !t.steps) return t
            const steps = [...t.steps]
            const i = steps.findIndex((st) => st.id === stepId)
            const j = i + by
            if (i < 0 || j < 0 || j >= steps.length) return t
            ;[steps[i], steps[j]] = [steps[j], steps[i]]
            return { ...t, steps }
          }),
        })),
      reorderStep: (taskId, stepId, toIndex) =>
        set((s) => ({
          tasks: s.tasks.map((t) => {
            if (t.id !== taskId || !t.steps) return t
            const from = t.steps.findIndex((st) => st.id === stepId)
            if (from < 0) return t
            const steps = [...t.steps]
            const [moved] = steps.splice(from, 1)
            steps.splice(Math.max(0, Math.min(toIndex, steps.length)), 0, moved)
            return { ...t, steps }
          }),
        })),
      skipOccurrence: (id) =>
        set((s) => ({
          tasks: s.tasks.map((t) => {
            if (t.id !== id || !t.repeat || !t.due) return t
            const next = nextDue({ ...t.repeat, fromCompletion: false }, t.due, todayKey())
            if (!next) return t
            return { ...t, due: next, repeat: { ...t.repeat, occurrence: (t.repeat.occurrence ?? 1) + 1 } }
          }),
        })),
      deleteTask: (id) => set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) })),
      restoreTask: (task, index) =>
        set((s) => {
          if (s.tasks.some((t) => t.id === task.id)) return {}
          const tasks = [...s.tasks]
          tasks.splice(Math.max(0, Math.min(index, tasks.length)), 0, task)
          return { tasks }
        }),

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
      setWeekLayout: (weekLayout) => set({ weekLayout }),

      importData: (data) => set({ ...normalizeSnapshot(data), expanded: {} }),
      applyRemote: (data) => set(normalizeSnapshot(data)),
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
        weekLayout: s.weekLayout,
      }),
    },
  ),
)

export function exportSnapshot(): DataSnapshot {
  const { areas, pages, tasks, habits } = useStore.getState()
  return { areas, pages, tasks, habits }
}
