# Hearth

A calm, block-based workspace for managing your life rather than your job.
Everything is organised around **life areas** (health, money, home, people,
growth, leisure) and each area holds its own tasks, pages and habits.

Dark autumn palette, burgundy accent. It runs as an installable web app: sign in
once, add it to your phone's home screen, and your data syncs between devices and
keeps working offline.

**To put it online with your own domain, follow [SETUP.md](SETUP.md).**

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
- **Sign-in and sync** – your account's data lives in Supabase, protected so only
  you can read it; edits sync between devices, merge sensibly if two devices
  changed things at once, and wait on the device while offline.
- **Installable** – add to the home screen on iPhone and Android; opens offline.
- **Your data** – export and import a JSON backup from the sidebar.

`Ctrl/⌘ + \` toggles the sidebar.

## Run it

```bash
npm install
cp .env.example .env.local   # optional: your Supabase URL and key
npm run dev
```

Without `.env.local` the app runs in local-only mode (no login, data stays in the
browser).

Build a static site into `dist/` (it can be hosted anywhere, including GitHub
Pages):

```bash
npm run build
```

## Stack

React 19, TypeScript, Vite, Zustand, Supabase (auth + Postgres), a small service
worker for offline use, Lucide icons, Inter and Fraunces fonts. Hosted as a
static site (Cloudflare Pages).

## Project layout

```
src/
  store.ts        app state, persistence, import/export
  auth/           sign-in, password reset
  sync/           cloud sync engine and three-way merge
  seed.ts         sample content shown on first run
  editor/         block editor (blocks, slash menu, caret helpers)
  views/          Today, Upcoming, Habits, Area, Page
  components/     sidebar, search, task rows, menus and dialogs
  lib/            dates, routing, sanitising, small hooks
  styles.css      the whole design system
  pwa.ts          service worker registration
public/
  sw.js           offline cache
  manifest.webmanifest, icons/   home-screen app details
  _headers, robots.txt           keep search engines out
supabase/
  schema.sql      database table and security rules
```
