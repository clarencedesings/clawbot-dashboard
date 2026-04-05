/**
 * Pure SVG sparkline — no dependencies.
 * Renders a small trend line with gradient fill.
 * Uses viewBox so it stretches to fill container width.
 */
export default function Sparkline({ data = [], color = '#6366f1', height = 32 }) {
  if (data.length < 2) return null

  const vw = 200 // virtual width for viewBox coordinates
  const vh = height
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const range = max - min || 1
  const padY = 2

  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * vw
    const y = padY + ((max - v) / range) * (vh - padY * 2)
    return `${x},${y}`
  })

  const linePath = `M${points.join(' L')}`
  const areaPath = `${linePath} L${vw},${vh} L0,${vh} Z`
  const id = `spark-${color.replace('#', '')}-${data.length}`

  return (
    <svg
      viewBox={`0 0 ${vw} ${vh}`}
      preserveAspectRatio="none"
      className="block w-full"
      style={{ height }}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#${id})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
