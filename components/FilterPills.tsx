'use client'

import { BRANDS } from '@/lib/config'
import type { BrandKey } from '@/types'

interface FilterPillsProps {
  activeBrand: 'all' | BrandKey
  activePlatform: 'all' | 'instagram' | 'tiktok'
  onBrandChange: (brand: 'all' | BrandKey) => void
  onPlatformChange: (platform: 'all' | 'instagram' | 'tiktok') => void
}

const brandOptions: { key: 'all' | BrandKey; label: string; dot?: string }[] = [
  { key: 'all', label: 'All Brands' },
  ...BRANDS.map((b) => ({ key: b.key, label: b.name, dot: b.color })),
]

const platformOptions: { key: 'all' | 'instagram' | 'tiktok'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'instagram', label: 'Instagram' },
  { key: 'tiktok', label: 'TikTok' },
]

function Pill({
  active,
  onClick,
  children,
  dot,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  dot?: string
}) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-150 border ${
        active
          ? 'bg-pr-navy text-white border-pr-navy shadow-sm'
          : 'bg-white text-pr-text border-pr-muted/30 hover:border-pr-navy hover:text-pr-navy'
      }`}
    >
      {dot && (
        <span
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{ backgroundColor: dot }}
        />
      )}
      {children}
    </button>
  )
}

export default function FilterPills({
  activeBrand,
  activePlatform,
  onBrandChange,
  onPlatformChange,
}: FilterPillsProps) {
  return (
    <div className="flex flex-col sm:flex-row gap-3">
      {/* Brand filters */}
      <div className="flex flex-wrap gap-2">
        {brandOptions.map((opt) => (
          <Pill
            key={opt.key}
            active={activeBrand === opt.key}
            onClick={() => onBrandChange(opt.key)}
            dot={opt.dot}
          >
            {opt.label}
          </Pill>
        ))}
      </div>

      {/* Divider */}
      <div className="hidden sm:block w-px bg-pr-muted/20 self-stretch" />

      {/* Platform toggle */}
      <div className="flex gap-2">
        {platformOptions.map((opt) => (
          <Pill
            key={opt.key}
            active={activePlatform === opt.key}
            onClick={() => onPlatformChange(opt.key)}
          >
            {opt.label}
          </Pill>
        ))}
      </div>
    </div>
  )
}
