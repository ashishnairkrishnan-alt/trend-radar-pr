interface Props {
  size?: number
  className?: string
}

export default function PernodRicardLogo({ size = 40, className = '' }: Props) {
  const cx = 50
  const cy = 50
  const outerR = 47
  const innerR = 13
  const n = 11
  const slotDeg = 360 / n          // ~32.73° per slot
  const segDeg = 29                 // segment fills 29° leaving a ~3.7° gap
  const startDeg = -90              // first segment centred at top (12 o'clock)

  const rad = (d: number) => (d * Math.PI) / 180

  const pt = (angleDeg: number, r: number) => ({
    x: +(cx + r * Math.cos(rad(angleDeg))).toFixed(3),
    y: +(cy + r * Math.sin(rad(angleDeg))).toFixed(3),
  })

  const segments = Array.from({ length: n }, (_, i) => {
    const mid = startDeg + i * slotDeg
    const s = mid - segDeg / 2
    const e = mid + segDeg / 2

    const i1 = pt(s, innerR)
    const i2 = pt(e, innerR)
    const o1 = pt(s, outerR)
    const o2 = pt(e, outerR)

    const d = [
      `M ${i1.x} ${i1.y}`,
      `A ${innerR} ${innerR} 0 0 1 ${i2.x} ${i2.y}`,
      `L ${o2.x} ${o2.y}`,
      `A ${outerR} ${outerR} 0 0 0 ${o1.x} ${o1.y}`,
      'Z',
    ].join(' ')

    // Alternating dark navy / light blue — exact Pernod Ricard palette
    return { d, fill: i % 2 === 0 ? '#1B3F82' : '#7BADD8' }
  })

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
      {segments.map((s, i) => (
        <path key={i} d={s.d} fill={s.fill} />
      ))}
      {/* White centre circle */}
      <circle cx={cx} cy={cy} r={innerR - 1.5} fill="white" />
    </svg>
  )
}
