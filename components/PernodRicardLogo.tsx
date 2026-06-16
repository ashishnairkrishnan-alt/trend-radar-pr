interface PernodRicardLogoProps {
  size?: number
  className?: string
}

export default function PernodRicardLogo({ size = 36, className = '' }: PernodRicardLogoProps) {
  const cx = 50
  const cy = 50
  const outerR = 47
  const innerR = 14
  const numSegments = 11
  const anglePerSegment = 360 / numSegments
  const gapDeg = 1.5 // small gap between segments

  const toRad = (deg: number) => (deg * Math.PI) / 180

  const getPoint = (angleDeg: number, radius: number) => ({
    x: cx + radius * Math.cos(toRad(angleDeg - 90)),
    y: cy + radius * Math.sin(toRad(angleDeg - 90)),
  })

  const createSegmentPath = (startAngle: number, endAngle: number) => {
    const s = startAngle + gapDeg / 2
    const e = endAngle - gapDeg / 2
    const p1 = getPoint(s, innerR)
    const p2 = getPoint(e, innerR)
    const p3 = getPoint(e, outerR)
    const p4 = getPoint(s, outerR)
    const largeArc = endAngle - startAngle > 180 ? 1 : 0
    return [
      `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)}`,
      `A ${innerR} ${innerR} 0 ${largeArc} 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`,
      `L ${p3.x.toFixed(2)} ${p3.y.toFixed(2)}`,
      `A ${outerR} ${outerR} 0 ${largeArc} 0 ${p4.x.toFixed(2)} ${p4.y.toFixed(2)}`,
      'Z',
    ].join(' ')
  }

  // Alternating dark navy and light blue — matching the Pernod Ricard brand palette
  const colors = ['#0D2D6B', '#6B9FD4']

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Pernod Ricard"
    >
      {Array.from({ length: numSegments }).map((_, i) => {
        const startAngle = i * anglePerSegment
        const endAngle = (i + 1) * anglePerSegment
        return (
          <path
            key={i}
            d={createSegmentPath(startAngle, endAngle)}
            fill={colors[i % 2]}
          />
        )
      })}
      {/* Central white oval */}
      <ellipse cx={cx} cy={cy} rx={innerR - 1} ry={innerR - 1} fill="white" />
    </svg>
  )
}
