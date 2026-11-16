import {
  CheckSquare,
  Heading1,
  Heading2,
  Heading3,
  Lightbulb,
  List,
  ListOrdered,
  Minus,
  Quote,
  Type,
  type LucideIcon,
} from 'lucide-react'
import { escapeHtml } from '../lib/sanitize'
import { uid } from '../lib/id'
import type { Block, BlockType } from '../types'

export interface Command {
  type: BlockType
  label: string
  hint: string
  icon: LucideIcon
  keywords: string
}

export const COMMANDS: Command[] = [
  { type: 'text', label: 'Text', hint: '', icon: Type, keywords: 'text plain paragraph' },
  { type: 'h1', label: 'Heading 1', hint: '#', icon: Heading1, keywords: 'heading 1 h1 title big' },
  { type: 'h2', label: 'Heading 2', hint: '##', icon: Heading2, keywords: 'heading 2 h2 subtitle' },
  { type: 'h3', label: 'Heading 3', hint: '###', icon: Heading3, keywords: 'heading 3 h3 small' },
  { type: 'todo', label: 'To-do list', hint: '[]', icon: CheckSquare, keywords: 'todo to-do task checkbox check' },
  { type: 'bullet', label: 'Bulleted list', hint: '-', icon: List, keywords: 'bullet list unordered' },
  { type: 'number', label: 'Numbered list', hint: '1.', icon: ListOrdered, keywords: 'number numbered list ordered' },
  { type: 'quote', label: 'Quote', hint: '>', icon: Quote, keywords: 'quote citation' },
  { type: 'callout', label: 'Callout', hint: '', icon: Lightbulb, keywords: 'callout note highlight tip' },
  { type: 'divider', label: 'Divider', hint: '---', icon: Minus, keywords: 'divider line separator hr' },
]

export function filterCommands(query: string): Command[] {
  const q = query.toLowerCase()
  if (!q) return COMMANDS
  return COMMANDS.filter((c) => c.keywords.split(' ').some((k) => k.startsWith(q)) || c.label.toLowerCase().includes(q))
}

/** Markdown-style prefixes that convert a text block when followed by a space. */
export const SHORTCUTS: Record<string, BlockType> = {
  '#': 'h1',
  '##': 'h2',
  '###': 'h3',
  '-': 'bullet',
  '*': 'bullet',
  '1.': 'number',
  '[]': 'todo',
  '[ ]': 'todo',
  '>': 'quote',
  '"': 'quote',
}

export const isList = (type: BlockType) => type === 'bullet' || type === 'number' || type === 'todo'

export function newBlock(type: BlockType = 'text', html = '', extra: Partial<Block> = {}): Block {
  return { id: uid(), type, html, ...extra }
}

/** Turn one line of pasted plain text into a block, honouring simple markdown. */
export function parseLine(line: string): Block {
  const rules: [RegExp, BlockType][] = [
    [/^###\s+/, 'h3'],
    [/^##\s+/, 'h2'],
    [/^#\s+/, 'h1'],
    [/^\s*(?:[-*•]\s+)?\[[ xX]?\]\s+/, 'todo'],
    [/^\s*[-*•]\s+/, 'bullet'],
    [/^\s*\d+[.)]\s+/, 'number'],
    [/^>\s+/, 'quote'],
  ]
  if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) return newBlock('divider')
  for (const [re, type] of rules) {
    const m = re.exec(line)
    if (m) {
      const checked = type === 'todo' && /\[[xX]\]/.test(m[0])
      return newBlock(type, escapeHtml(line.slice(m[0].length)), type === 'todo' ? { checked } : {})
    }
  }
  return newBlock('text', escapeHtml(line))
}

export const PLACEHOLDERS: Record<BlockType, string> = {
  text: 'Write, or press / for blocks',
  h1: 'Heading 1',
  h2: 'Heading 2',
  h3: 'Heading 3',
  bullet: 'List',
  number: 'List',
  todo: 'To-do',
  quote: 'Quote',
  callout: 'Something worth remembering',
  divider: '',
}
