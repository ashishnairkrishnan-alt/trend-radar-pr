interface Props {
  size?: number
  className?: string
}

export default function PernodRicardLogo({ size = 44, className = '' }: Props) {
  // 10 segments — wider & more visible than 11
  const cx = 50, cy = 50
  const outerR = 48
  const innerR = 9
  const n = 10
  const slotDeg = 360 / n   // 36° per slot
  const segDeg = 31          // 31° filled, 5° gap — clear rays at small sizes
  const startDeg = -90       // top = 12 o'clock

  const rad = (d: number) => (d * Math.PI) / 180
  const pt = (a: number, r: number) => ({
    x: +(cx + r * Math.cos(rad(a))).toFixed(2),
    y: +(cy + r * Math.sin(rad(a))).toFixed(2),
  })

  const segments = Array.from({ length: n }, (_, i) => {
    const mid = startDeg + i * slotDeg
    const s = mid - segDeg / 2
    const e = mid + segDeg / 2
    const i1 = pt(s, innerR), i2 = pt(e, innerR)
    const o1 = pt(s, outerR), o2 = pt(e, outerR)
    return {
      d: `M${i1.x} ${i1.y} A${innerR} ${innerR} 0 0 1 ${i2.x} ${i2.y} L${o2.x} ${o2.y} A${outerR} ${outerR} 0 0 0 ${o1.x} ${o1.y}Z`,
      fill: i % 2 === 0 ? '#1B3F82' : '#6FA8D0',
    }
  })

  return (
    <svg
      width={size} height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-label="Pernod Ricard"
    >
      {segments.map((s, i) => <path key={i} d={s.d} fill={s.fill} />)}
      <ellipse cx={cx} cy={cy} rx={innerR - 1} ry={innerR - 1} fill="white" />
    </svg>
  )
}
