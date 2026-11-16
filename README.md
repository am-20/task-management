# Hearth

A calm, block-based workspace for managing your life rather than your job.
Everything is organised around **life areas** (health, money, home, people,
growth, leisure) and each area holds its own tasks, pages and habits.

Dark autumn palette, burgundy accent, no account, no server: your data stays in
your browser.

## What it does

- **Today** – what is due or overdue, today's habits, and a card per life area.
- **Upcoming** – every open task grouped by when it is due, filterable by area.
- **Habits** – a weekly check-in grid with streaks.
- **Life areas** – create as many as you need; each has an icon, a colour,
  tasks, pages and habits.
- **Pages** – a block editor for notes, lists and plans:
  - blocks: text, three heading levels, to-do, bulleted and numbered lists,
    quote, callout, divider
  - type `/` for the block menu, or use shortcuts: `#`, `##`, `###`, `-`, `1.`,
    `[]`, `>` followed by a space, and `---` for a divider
  - `Tab` / `Shift+Tab` to nest list items, drag the handle to reorder,
    select text for bold, italic, underline and strikethrough
- **Search** – `Ctrl/⌘ + K` finds pages, tasks and areas.
- **Your data** – export and import a JSON backup from the sidebar.

`Ctrl/⌘ + \` toggles the sidebar.

## Run it

```bash
npm install
npm run dev
```

Build a static site into `dist/` (it can be hosted anywhere, including GitHub
Pages):

```bash
npm run build
```

## Stack

React 19, TypeScript, Vite, Zustand (persisted to `localStorage`), Lucide icons,
Inter and Fraunces fonts. No backend.

## Project layout

```
src/
  store.ts        app state, persistence, import/export
  seed.ts         sample content shown on first run
  editor/         block editor (blocks, slash menu, caret helpers)
  views/          Today, Upcoming, Habits, Area, Page
  components/     sidebar, search, task rows, menus and dialogs
  lib/            dates, routing, sanitising, small hooks
  styles.css      the whole design system
```
