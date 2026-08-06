// Pure HTML template builder — no server-side imports, safe to use in client components.
// Built with tables + inline styles for maximum email-client compatibility (Outlook, Gmail, Apple Mail).
// NOTE: never use flexbox/grid here — Outlook renders with Word's engine and ignores them.
import { BRANDS, APP_CONFIG } from './config'
import type { ScoredTrend } from '@/types'

const COLORS = {
  navy: '#0D1B3E',
  gold: '#C9A84C',
  cream: '#FAF6EE',
  bg: '#F4F4F6',
  text: '#1A2B4A',
  muted: '#5B6675',
  white: '#FFFFFF',
  ig: '#E1306C',
  tt: '#010101',
}

// Absolute URL to the logo (emails require absolute, publicly-reachable image URLs)
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://trend-radar-pr.vercel.app'
const LOGO_URL = `${APP_URL}/logo.png`

function platformBadge(platform: string): string {
  const isIG = platform === 'instagram'
  const bg = isIG ? COLORS.ig : COLORS.tt
  const label = isIG ? 'IG' : 'TT'
  return `<span style="background:${bg};color:#ffffff;font-size:10px;font-weight:700;padding:3px 8px;border-radius:4px;letter-spacing:0.05em;font-family:Arial,sans-serif;">${label}</span>`
}

// Decide the source-link label from the URL shape.
function sourceLinkLabel(url: string, platform: string): string {
  try {
    const u = new URL(url)
    const parts = u.pathname.split('/').filter(Boolean)
    if (u.hostname.includes('instagram')) {
      if (parts[0] === 'reels' && parts[1] === 'audio') return '♫ Trending audio'
      if (parts[0] === 'reel') return 'View Reel'
      if (parts[0] === 'p') return 'View Post'
      return 'View on Instagram'
    }
    if (u.hostname.includes('tiktok')) {
      if (parts[0] === 'music') return '♫ Trending audio'
      if (u.pathname.includes('/video/')) return 'Watch video'
      if (u.pathname.includes('/search')) return 'Explore on TikTok'
      return 'View on TikTok'
    }
    return 'View source'
  } catch {
    return 'View source'
  }
}

function sourceButton(trend: ScoredTrend): string {
  if (!trend.source_url) return ''
  const isIG = trend.platform === 'instagram'
  const bg = isIG ? COLORS.ig : COLORS.tt
  const label = sourceLinkLabel(trend.source_url, trend.platform)
  // Table-wrapped button (bulletproof for Outlook)
  return `
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px;">
        <tr>
          <td style="border-radius:6px;background:${bg};">
            <a href="${trend.source_url}" target="_blank" style="display:inline-block;padding:8px 16px;font-size:12px;font-weight:700;color:#ffffff;text-decoration:none;font-family:Arial,sans-serif;border-radius:6px;">
              ${label} &nbsp;&rarr;
            </a>
          </td>
        </tr>
      </table>`
}

function scoreBars(trend: ScoredTrend): string {
  return BRANDS.map((brand) => {
    const score = trend[brand.scoreField] as number
    const pct = Math.round((score / 5) * 100)
    return `
      <tr>
        <td style="padding:3px 0;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td style="font-size:10px;color:${COLORS.muted};font-family:Arial,sans-serif;text-transform:uppercase;letter-spacing:0.06em;">${brand.name}</td>
              <td align="right" style="font-size:10px;font-weight:700;color:${brand.color};font-family:Arial,sans-serif;">${score}/5</td>
            </tr>
          </table>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-top:2px;background:#E5E7EB;border-radius:4px;">
            <tr>
              <td style="height:6px;line-height:6px;font-size:0;background:${brand.color};border-radius:4px;width:${pct}%;">&nbsp;</td>
              <td style="height:6px;line-height:6px;font-size:0;width:${100 - pct}%;">&nbsp;</td>
            </tr>
          </table>
        </td>
      </tr>`
  }).join('')
}

function noveltyTag(isNew?: boolean): string {
  if (isNew === true) return `<span style="margin-left:8px;background:#DCFCE7;color:#15803D;font-size:10px;font-weight:700;padding:2px 7px;border-radius:4px;font-family:Arial,sans-serif;">NEW</span>`
  if (isNew === false) return `<span style="margin-left:8px;background:#F3F4F6;color:#6B7280;font-size:10px;font-weight:600;padding:2px 7px;border-radius:4px;font-family:Arial,sans-serif;">Seen before</span>`
  return ''
}

function trendCard(trend: ScoredTrend): string {
  const topBrandObj = BRANDS.find((b) =>
    b.name.toLowerCase().includes(trend.top_brand.toLowerCase()) ||
    trend.top_brand.toLowerCase().includes(b.key)
  )
  const topBrandColor = topBrandObj?.color || COLORS.gold

  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${COLORS.white};border-radius:10px;margin-bottom:20px;border-left:4px solid ${COLORS.gold};">
    <tr>
      <td style="padding:18px 20px;">

        <!-- Top row: platform badge + spike -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
          <tr>
            <td valign="middle">${platformBadge(trend.platform)}${noveltyTag(trend.isNew)}</td>
            <td valign="middle" align="right">
              <span style="background:${COLORS.gold};color:${COLORS.navy};font-size:13px;font-weight:800;padding:4px 10px;border-radius:6px;font-family:Arial,sans-serif;">+${trend.spike_pct}%</span>
            </td>
          </tr>
        </table>

        <!-- Trend name -->
        <div style="font-size:18px;font-weight:700;color:${COLORS.text};font-family:Georgia,serif;line-height:1.3;margin-top:12px;">${trend.trend_name}</div>

        <!-- Emotional hook -->
        <div style="font-size:13px;color:${COLORS.muted};font-family:Arial,sans-serif;font-style:italic;line-height:1.5;margin-top:6px;">${trend.emotional_hook}</div>

        <!-- Source link button -->
        ${sourceButton(trend)}

        <!-- Brand scores -->
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${COLORS.bg};border-radius:8px;margin-top:16px;">
          <tr><td style="padding:12px 14px;">
            <div style="font-size:10px;color:${COLORS.muted};text-transform:uppercase;letter-spacing:0.1em;font-family:Arial,sans-serif;margin-bottom:6px;">Brand Relevance</div>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${scoreBars(trend)}</table>
          </td></tr>
        </table>

        <!-- Best fit -->
        <div style="margin-top:14px;">
          <span style="font-size:10px;color:${COLORS.muted};text-transform:uppercase;letter-spacing:0.1em;font-family:Arial,sans-serif;">Best fit:&nbsp;</span>
          <span style="background:${topBrandColor}22;color:${topBrandColor};font-size:11px;font-weight:700;padding:3px 10px;border-radius:20px;font-family:Arial,sans-serif;">${trend.top_brand}</span>
        </div>

        <!-- Opportunity note -->
        <div style="font-size:13px;color:${COLORS.text};font-style:italic;font-family:Georgia,serif;margin-top:12px;line-height:1.5;">&ldquo;${trend.opportunity_note}&rdquo;</div>

        <!-- Content angle -->
        <div style="margin-top:12px;">
          <span style="display:inline-block;background:${COLORS.navy};color:${COLORS.gold};font-size:11px;padding:5px 12px;border-radius:20px;font-family:Arial,sans-serif;font-weight:600;">${trend.content_angle}</span>
        </div>

      </td>
    </tr>
  </table>`
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
        <div style="margin-bottom:28px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:14px;border-bottom:2px solid ${color}33;">
            <tr>
              <td style="padding-bottom:8px;">
                <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};vertical-align:middle;">&nbsp;</span>
                <span style="font-size:15px;font-weight:700;color:${COLORS.text};font-family:Georgia,serif;text-transform:uppercase;letter-spacing:0.08em;vertical-align:middle;margin-left:8px;">${brand}</span>
                <span style="font-size:12px;color:${COLORS.muted};font-family:Arial,sans-serif;vertical-align:middle;margin-left:8px;">${brandTrends.length} trend${brandTrends.length > 1 ? 's' : ''}</span>
              </td>
            </tr>
          </table>
          ${brandTrends.map(trendCard).join('')}
        </div>`
    })
    .join('')

  return `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <title>Trend Radar — Week ${weekNumber} ${APP_CONFIG.fiscalYear}</title>
  <!--[if mso]>
  <style type="text/css">table{border-collapse:collapse;}</style>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background:${COLORS.bg};font-family:Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${COLORS.bg};">
    <tr>
      <td align="center" style="padding:0;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="640" style="max-width:640px;width:100%;">

          <!-- Logo band (white, matches dashboard) -->
          <tr>
            <td style="background:${COLORS.white};padding:18px 32px;text-align:center;border-bottom:1px solid #E8E0D0;">
              <img src="${LOGO_URL}" alt="Pernod Ricard" width="150" style="display:inline-block;width:150px;height:auto;border:0;" />
            </td>
          </tr>

          <!-- Header -->
          <tr>
            <td style="background:${COLORS.navy};padding:30px 32px;text-align:center;">
              <div style="font-size:11px;color:${COLORS.gold};letter-spacing:0.2em;text-transform:uppercase;font-family:Arial,sans-serif;margin-bottom:8px;">Pernod Ricard Middle East</div>
              <div style="font-size:30px;font-weight:700;color:${COLORS.white};font-family:Georgia,serif;letter-spacing:0.02em;">Trend Radar &middot; Reels</div>
              <div style="font-size:16px;color:${COLORS.gold};font-family:Georgia,serif;margin-top:4px;">Trending Reels &middot; Week ${weekNumber} &middot; ${APP_CONFIG.fiscalYear}</div>
              <div style="font-size:12px;color:#8A9CC0;font-family:Arial,sans-serif;margin-top:10px;">${sendDate}</div>
            </td>
          </tr>

          <!-- Summary bar -->
          <tr>
            <td style="background:${COLORS.cream};padding:14px 32px;border-bottom:1px solid #E8E0D0;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="font-size:12px;color:${COLORS.muted};font-family:Arial,sans-serif;text-transform:uppercase;letter-spacing:0.1em;">This week's top trends</td>
                  <td align="right" style="font-size:22px;font-weight:800;color:${COLORS.gold};font-family:Arial,sans-serif;">${trends.length}</td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:28px 24px;background:${COLORS.bg};">${brandSections}</td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:${COLORS.navy};padding:24px 32px;text-align:center;">
              <div style="font-size:11px;color:#8A9CC0;font-family:Arial,sans-serif;margin-bottom:4px;">Powered by AI &mdash; Pernod Ricard Middle East Social Listening</div>
              <div style="font-size:10px;color:#5A6a88;font-family:Arial,sans-serif;">This digest is generated automatically every Monday morning.</div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
