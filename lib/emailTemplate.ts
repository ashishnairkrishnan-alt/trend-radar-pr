// Pure HTML template builder — no server-side imports, safe to use in client components
import { BRANDS, APP_CONFIG } from './config'
import type { ScoredTrend } from '@/types'

const COLORS = {
  navy: '#0D1B3E',
  gold: '#C9A84C',
  cream: '#FAF6EE',
  bg: '#F4F4F6',
  text: '#1A2B4A',
  muted: '#8A94A6',
  white: '#FFFFFF',
  ig: '#E1306C',
  tt: '#010101',
}

function platformBadge(platform: string): string {
  const isIG = platform === 'instagram'
  const bg = isIG ? COLORS.ig : COLORS.tt
  const label = isIG ? 'IG' : 'TT'
  return `<span style="background:${bg};color:#fff;font-size:10px;font-weight:700;padding:2px 7px;border-radius:4px;letter-spacing:0.05em;font-family:Arial,sans-serif;">${label}</span>`
}

function scoreBars(trend: ScoredTrend): string {
  return BRANDS.map((brand) => {
    const score = trend[brand.scoreField] as number
    const pct = (score / 5) * 100
    return `
      <div style="margin-bottom:6px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:2px;">
          <span style="font-size:10px;color:${COLORS.muted};font-family:Arial,sans-serif;text-transform:uppercase;letter-spacing:0.08em;">${brand.name}</span>
          <span style="font-size:10px;font-weight:700;color:${brand.color};font-family:Arial,sans-serif;">${score}/5</span>
        </div>
        <div style="background:#E5E7EB;border-radius:4px;height:6px;width:100%;">
          <div style="background:${brand.color};border-radius:4px;height:6px;width:${pct}%;"></div>
        </div>
      </div>`
  }).join('')
}

function trendCard(trend: ScoredTrend): string {
  const topBrandObj = BRANDS.find((b) =>
    b.name.toLowerCase().includes(trend.top_brand.toLowerCase()) ||
    trend.top_brand.toLowerCase().includes(b.key)
  )
  const topBrandColor = topBrandObj?.color || COLORS.gold

  return `
  <div style="background:${COLORS.white};border-radius:10px;margin-bottom:20px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,0.08);border-left:4px solid ${COLORS.gold};">
    <div style="padding:16px 20px 12px;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
        <div style="flex:1;">
          <div style="margin-bottom:6px;">${platformBadge(trend.platform)}</div>
          <div style="font-size:17px;font-weight:700;color:${COLORS.text};font-family:Georgia,serif;line-height:1.3;">${trend.trend_name}</div>
        </div>
        <div style="text-align:right;margin-left:16px;flex-shrink:0;">
          <div style="background:${COLORS.gold};color:${COLORS.navy};font-size:13px;font-weight:800;padding:4px 10px;border-radius:6px;font-family:Arial,sans-serif;">+${trend.spike_pct}%</div>
        </div>
      </div>
      <div style="font-size:13px;color:${COLORS.muted};font-family:Arial,sans-serif;font-style:italic;line-height:1.5;margin-bottom:12px;">${trend.emotional_hook}</div>
      <div style="background:${COLORS.bg};border-radius:8px;padding:12px 14px;margin-bottom:12px;">
        ${scoreBars(trend)}
      </div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
        <span style="font-size:10px;color:${COLORS.muted};text-transform:uppercase;letter-spacing:0.1em;font-family:Arial,sans-serif;">Best fit:</span>
        <span style="background:${topBrandColor}22;color:${topBrandColor};font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;font-family:Arial,sans-serif;">${trend.top_brand}</span>
      </div>
      <div style="font-size:13px;color:${COLORS.text};font-style:italic;font-family:Georgia,serif;margin-bottom:10px;line-height:1.5;">"${trend.opportunity_note}"</div>
      <div style="display:inline-block;background:${COLORS.navy};color:${COLORS.gold};font-size:11px;padding:4px 12px;border-radius:20px;font-family:Arial,sans-serif;font-weight:600;">${trend.content_angle}</div>
    </div>
  </div>`
}

function groupByTopBrand(trends: ScoredTrend[]): Record<string, ScoredTrend[]> {
  return trends.reduce((acc, trend) => {
    const key = trend.top_brand
    if (!acc[key]) acc[key] = []
    acc[key].push(trend)
    return acc
  }, {} as Record<string, ScoredTrend[]>)
}

export function buildDigestHtml(trends: ScoredTrend[], weekNumber: number, year: number): string {
  const sendDate = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  const grouped = groupByTopBrand(trends)
  const brandSections = Object.entries(grouped)
    .map(([brand, brandTrends]) => {
      const brandObj = BRANDS.find(
        (b) => b.name.toLowerCase().includes(brand.toLowerCase()) || brand.toLowerCase().includes(b.key)
      )
      const color = brandObj?.color || COLORS.gold
      return `
        <div style="margin-bottom:32px;">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;padding-bottom:10px;border-bottom:2px solid ${color}22;">
            <div style="width:10px;height:10px;border-radius:50%;background:${color};"></div>
            <h2 style="margin:0;font-size:16px;font-weight:700;color:${COLORS.text};font-family:Georgia,serif;text-transform:uppercase;letter-spacing:0.08em;">${brand}</h2>
            <span style="font-size:12px;color:${COLORS.muted};font-family:Arial,sans-serif;">${brandTrends.length} trend${brandTrends.length > 1 ? 's' : ''}</span>
          </div>
          ${brandTrends.map(trendCard).join('')}
        </div>`
    })
    .join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <title>Trend Radar — Week ${weekNumber} ${APP_CONFIG.fiscalYear}</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.bg};font-family:Arial,sans-serif;">
  <div style="max-width:640px;margin:0 auto;background:${COLORS.bg};">
    <div style="background:${COLORS.navy};padding:28px 32px;text-align:center;">
      <div style="font-size:11px;color:${COLORS.gold};letter-spacing:0.2em;text-transform:uppercase;font-family:Arial,sans-serif;margin-bottom:6px;">Pernod Ricard Middle East</div>
      <h1 style="margin:0 0 4px;font-size:28px;font-weight:700;color:${COLORS.white};font-family:Georgia,serif;">Trend Radar</h1>
      <div style="font-size:16px;color:${COLORS.gold};font-family:Georgia,serif;margin-bottom:12px;">Week ${weekNumber} · ${APP_CONFIG.fiscalYear}</div>
      <div style="font-size:12px;color:#8A9CC0;font-family:Arial,sans-serif;">${sendDate}</div>
    </div>
    <div style="background:${COLORS.cream};padding:14px 32px;border-bottom:1px solid #E8E0D0;">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span style="font-size:12px;color:${COLORS.muted};font-family:Arial,sans-serif;text-transform:uppercase;letter-spacing:0.1em;">This week's top trends</span>
        <span style="font-size:20px;font-weight:800;color:${COLORS.gold};font-family:Arial,sans-serif;">${trends.length}</span>
      </div>
    </div>
    <div style="padding:28px 24px;">${brandSections}</div>
    <div style="background:${COLORS.navy};padding:24px 32px;text-align:center;">
      <div style="font-size:11px;color:#8A9CC0;font-family:Arial,sans-serif;margin-bottom:4px;">Powered by AI — Pernod Ricard Middle East Social Listening</div>
      <div style="font-size:10px;color:#4A5568;font-family:Arial,sans-serif;">This digest is generated automatically every Monday morning. Reply to unsubscribe.</div>
    </div>
  </div>
</body>
</html>`
}

