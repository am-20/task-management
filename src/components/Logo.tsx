import { useId } from 'react'

const PETAL = 'M50 50 C40 42 38 26 50 13 C62 26 60 42 50 50 Z'
const LEAF = 'M50 50 C46 44 46 37 50 31 C54 37 54 44 50 50 Z'

/** The Hearth mark: a white ring and blossom on deep red. `detail` adds the small leaves for large sizes. */
export function Logo({ size = 22, detail = size >= 40 }: { size?: number; detail?: boolean }) {
  const id = useId()
  const stroke = size >= 120 ? 3.4 : size >= 40 ? 4.4 : 7
  const scale = size >= 40 ? 0.8 : 0.9
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden="true">
      <defs>
        <radialGradient id={id} cx="0.3" cy="0.2" r="1">
          <stop offset="0" stopColor="#9e1414" />
          <stop offset="1" stopColor="#6b0000" />
        </radialGradient>
      </defs>
      <rect width="100" height="100" rx="24" fill={`url(#${id})`} />
      <g
        transform={`translate(50 50) scale(${scale}) translate(-50 -50)`}
        fill="none"
        stroke="#fff"
        strokeWidth={stroke}
        strokeLinejoin="round"
      >
        <circle cx="50" cy="50" r="40" />
        {[0, 90, 180, 270].map((r) => (
          <path key={r} d={PETAL} transform={`rotate(${r} 50 50)`} />
        ))}
        {detail &&
          [45, 135, 225, 315].map((r) => (
            <path key={r} d={LEAF} transform={`rotate(${r} 50 50) translate(0 -10)`} />
          ))}
      </g>
    </svg>
  )
}
