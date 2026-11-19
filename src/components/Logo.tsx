import { useId } from 'react'

const MOON = 'M61 13 C38 15 24 36 29.5 57 C34 74 52 84 70 80 C53 75 41.5 62 41.5 46.5 C41.5 31 49.5 19 61 13Z'
const THORNS = ['M33.8 31.5 L24.5 25 L30.6 36Z', 'M29.6 47 L19.5 45.5 L29 51.6Z', 'M33 64.5 L24 70.5 L35.4 68.4Z']
const STAR =
  'M66 24 C67.1 40.25 68.64 47.9 78 49 C68.64 50.1 67.1 59.15 66 78 C64.9 59.15 63.36 50.1 54 49 C63.36 47.9 64.9 40.25 66 24Z'
const SPARK =
  'M77 15.5 C77.5 19.075 77.968 20.5 81.4 21 C77.968 21.5 77.5 22.925 77 26.5 C76.5 22.925 76.032 21.5 72.6 21 C76.032 20.5 76.5 19.075 77 15.5Z'

/** The Hearth mark: a thorned crescent and a needle star, white on deep red. */
export function Logo({ size = 22, detail = size >= 40 }: { size?: number; detail?: boolean }) {
  const id = useId()
  const scale = size >= 40 ? 0.82 : 0.92
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
      <defs>
        <radialGradient id={id} cx="0.3" cy="0.2" r="1">
          <stop offset="0" stopColor="#9e1414" />
          <stop offset="1" stopColor="#6b0000" />
        </radialGradient>
      </defs>
      <rect width="100" height="100" rx="24" fill={`url(#${id})`} />
      <g transform={`translate(50 50) scale(${scale}) translate(-50 -50)`} fill="#fff">
        <path d={MOON} />
        {THORNS.map((d) => (
          <path key={d} d={d} />
        ))}
        <path d={STAR} />
        {detail && <path d={SPARK} />}
      </g>
    </svg>
  )
}
