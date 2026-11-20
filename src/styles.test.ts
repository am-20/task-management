import { describe, expect, it } from 'vitest'
import stylesheet from './styles.css?raw'

// Page lines use the class "block". A style meant for something else once reused that
// name and pinned every line of every page in place. Keep page lines in normal flow.
describe('styles', () => {
  it('never pins page lines (.block) in place', () => {
    const css = stylesheet.replace(/\/\*[\s\S]*?\*\//g, '')
    const offenders: string[] = []
    for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      // Pseudo-elements (::before drop markers) are decorations, not the line itself.
      const selectors = m[1]
        .split(',')
        .map((x: string) => x.trim())
        .filter((x: string) => !x.includes('::'))
      const hitsBlock = selectors.some((sel: string) => /(^|[\s>+~])\.block(?=$|[\s.:>[])/.test(sel))
      if (hitsBlock && /position:\s*(absolute|fixed)/.test(m[2])) offenders.push(m[1].trim())
    }
    expect(offenders).toEqual([])
  })
})
