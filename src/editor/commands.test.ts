import { describe, expect, it } from 'vitest'
import { isDividerText, shortcutBefore } from './commands'

describe('shortcuts typed on any keyboard', () => {
  it.each([
    ['- ', 'bullet'],
    ['* ', 'bullet'],
    ['• ', 'bullet'],
    ['# ', 'h1'],
    ['## ', 'h2'],
    ['### ', 'h3'],
    ['1. ', 'number'],
    ['1) ', 'number'],
    ['[] ', 'todo'],
    ['[ ] ', 'todo'],
    ['> ', 'quote'],
    ['“ ', 'quote'],
    ['- ', 'bullet'], // phones often insert a no-break space
  ])('%j → %s', (typed, type) => expect(shortcutBefore(typed)).toBe(type))

  it('leaves ordinary text alone', () => {
    expect(shortcutBefore('a ')).toBeNull()
    expect(shortcutBefore('Hello ')).toBeNull()
    expect(shortcutBefore('-')).toBeNull()
    expect(shortcutBefore('- item')).toBeNull()
    expect(shortcutBefore('#### ')).toBeNull()
  })

  it('spots a divider however the dashes were turned into', () => {
    for (const t of ['---', '—-', '–-', '——', '-—']) expect(isDividerText(t)).toBe(true)
    for (const t of ['—', '--', 'a---']) expect(isDividerText(t)).toBe(false)
  })
})
