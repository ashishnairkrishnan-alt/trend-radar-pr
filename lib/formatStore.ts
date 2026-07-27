import type { FormatTrend, FormatBrandKey } from './formatTrends'

// Storage mapping for the `format_trends` table. Kept separate from the generator
// (which imports the Anthropic SDK) so the read/email routes stay lightweight.

export function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

export function trendToRow(t: FormatTrend, weekNumber: number, year: number): Record<string, unknown> {
  return {
    week_number: weekNumber,
    year,
    trend_name: t.trend_name,
    description: t.description,
    format: t.format,
    turnaround_label: t.turnaround.label,
    turnaround_level: t.turnaround.level,
    top_brand: t.top_brand,
    chivas_score: t.brands.chivas.score, chivas_angle: t.brands.chivas.angle,
    absolut_score: t.brands.absolut.score, absolut_angle: t.brands.absolut.angle,
    jameson_score: t.brands.jameson.score, jameson_angle: t.brands.jameson.angle,
    glenlivet_score: t.brands.glenlivet.score, glenlivet_angle: t.brands.glenlivet.angle,
    google_images: t.googleImages,
  }
}

export function rowToTrend(row: Record<string, unknown>): FormatTrend {
  const b = (k: FormatBrandKey) => ({
    score: Number(row[`${k}_score`]) || 0,
    angle: String(row[`${k}_angle`] || ''),
  })
  return {
    trend_name: String(row.trend_name || ''),
    description: String(row.description || ''),
    format: (row.format === 'Carousel' ? 'Carousel' : 'Static'),
    turnaround: { label: String(row.turnaround_label || ''), level: String(row.turnaround_level || '') },
    top_brand: (['chivas', 'absolut', 'jameson', 'glenlivet'].includes(String(row.top_brand))
      ? (row.top_brand as FormatBrandKey)
      : 'chivas'),
    brands: { chivas: b('chivas'), absolut: b('absolut'), jameson: b('jameson'), glenlivet: b('glenlivet') },
    googleImages: String(row.google_images || ''),
  }
}
