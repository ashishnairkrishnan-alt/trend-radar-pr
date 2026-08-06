import { APP_CONFIG } from './config'
import type { FormatTrend, FormatBrandKey } from './formatTrends'

// Outlook-safe (table + inline styles) email for the Static & Carousel digest.
// Mirrors the Reels digest look. No flexbox.

const COLORS = {
  navy: '#0D1B3E', gold: '#C9A84C', cream: '#FAF6EE', bg: '#F4F4F6',
  text: '#1A2B4A', muted: '#5B6675', white: '#FFFFFF',
  carousel: '#3B82F6', static: '#16A34A',
}

const BRAND_LABEL: Record<FormatBrandKey, string> = {
  chivas: 'Chivas Regal', absolut: 'Absolut Vodka', jameson: 'Jameson', glenlivet: 'The Glenlivet',
}
const BRAND_COLOR: Record<FormatBrandKey, string> = {
  chivas: '#F5A623', absolut: '#8A94A6', jameson: '#4CAF72', glenlivet: '#2E7D52',
}
const BRAND_ORDER: FormatBrandKey[] = ['chivas', 'absolut', 'jameson', 'glenlivet']

const LOGO_URL = `${process.env.NEXT_PUBLIC_APP_URL || 'https://trend-radar-pr.vercel.app'}/logo.png`

function card(t: FormatTrend): string {
  const fmtColor = t.format === 'Carousel' ? COLORS.carousel : COLORS.static
  const topColor = BRAND_COLOR[t.top_brand] || COLORS.gold

  const brandRows = BRAND_ORDER.map((k) => {
    const b = t.brands[k]
    const isTop = k === t.top_brand
    return `
      <tr>
        <td style="padding:4px 0;font-size:11px;font-family:Arial,sans-serif;color:${BRAND_COLOR[k]};font-weight:${isTop ? 700 : 600};width:110px;">${BRAND_LABEL[k]}${isTop ? ' ★' : ''}</td>
        <td style="padding:4px 0 4px 8px;font-size:11px;font-family:Arial,sans-serif;color:${COLORS.text};">${b.angle || '-'} <span style="color:${COLORS.muted};">(${b.score}/5)</span></td>
      </tr>`
  }).join('')

  return `
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${COLORS.white};border-radius:10px;margin-bottom:18px;border-left:4px solid ${fmtColor};">
    <tr><td style="padding:16px 20px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%"><tr>
        <td valign="middle">
          <span style="background:${fmtColor}1A;color:${fmtColor};font-size:11px;font-weight:700;padding:3px 9px;border-radius:5px;font-family:Arial,sans-serif;">${t.format}</span>
          <span style="color:${COLORS.muted};font-size:11px;font-family:Arial,sans-serif;">&nbsp;&nbsp;${t.turnaround.label}</span>
        </td>
        <td valign="middle" align="right">
          <span style="background:${topColor}1A;color:${topColor};font-size:10px;font-weight:700;padding:3px 9px;border-radius:20px;font-family:Arial,sans-serif;">★ ${BRAND_LABEL[t.top_brand]}</span>
        </td>
      </tr></table>

      <div style="font-size:17px;font-weight:700;color:${COLORS.text};font-family:Georgia,serif;margin-top:10px;">${t.trend_name}</div>
      <div style="font-size:12.5px;color:${COLORS.muted};font-family:Arial,sans-serif;line-height:1.5;margin-top:4px;">${t.description}</div>

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${COLORS.bg};border-radius:8px;margin-top:12px;">
        <tr><td style="padding:10px 14px;">
          <div style="font-size:10px;color:${COLORS.muted};text-transform:uppercase;letter-spacing:0.08em;font-family:Arial,sans-serif;margin-bottom:4px;">Per-brand angle</div>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">${brandRows}</table>
        </td></tr>
      </table>

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:12px;"><tr>
        <td style="border-radius:6px;background:#4285F4;">
          <a href="${t.googleImages}" target="_blank" style="display:inline-block;padding:8px 15px;font-size:12px;font-weight:700;color:#fff;text-decoration:none;font-family:Arial,sans-serif;border-radius:6px;">See real examples &rarr;</a>
        </td>
      </tr></table>
    </td></tr>
  </table>`
}

function section(title: string, color: string, trends: FormatTrend[]): string {
  if (trends.length === 0) return ''
  return `
    <div style="margin-bottom:26px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin-bottom:12px;border-bottom:2px solid ${color}33;">
        <tr><td style="padding-bottom:8px;">
          <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${color};vertical-align:middle;">&nbsp;</span>
          <span style="font-size:15px;font-weight:700;color:${COLORS.text};font-family:Georgia,serif;text-transform:uppercase;letter-spacing:0.06em;vertical-align:middle;margin-left:8px;">${title}</span>
          <span style="font-size:12px;color:${COLORS.muted};font-family:Arial,sans-serif;vertical-align:middle;margin-left:8px;">${trends.length}</span>
        </td></tr>
      </table>
      ${trends.map(card).join('')}
    </div>`
}

export function buildFormatDigestHtml(trends: FormatTrend[], weekNumber: number, year: number): string {
  const sendDate = new Date().toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const statics = trends.filter((t) => t.format === 'Static')
  const carousels = trends.filter((t) => t.format === 'Carousel')

  return `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><title>Static &amp; Carousel Trends</title></head>
<body style="margin:0;padding:0;background:${COLORS.bg};font-family:Arial,sans-serif;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:${COLORS.bg};"><tr><td align="center">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="640" style="max-width:640px;width:100%;">
      <tr><td style="background:${COLORS.white};padding:18px 32px;text-align:center;border-bottom:1px solid #E8E0D0;">
        <img src="${LOGO_URL}" alt="Pernod Ricard" width="150" style="width:150px;height:auto;border:0;" />
      </td></tr>
      <tr><td style="background:${COLORS.navy};padding:28px 32px;text-align:center;">
        <div style="font-size:11px;color:${COLORS.gold};letter-spacing:0.2em;text-transform:uppercase;font-family:Arial,sans-serif;margin-bottom:8px;">Pernod Ricard Middle East</div>
        <div style="font-size:28px;font-weight:700;color:${COLORS.white};font-family:Georgia,serif;">Static &amp; Carousel Trends</div>
        <div style="font-size:15px;color:${COLORS.gold};font-family:Georgia,serif;margin-top:4px;">Week ${weekNumber} &middot; ${APP_CONFIG.fiscalYear}</div>
        <div style="font-size:12px;color:#8A9CC0;font-family:Arial,sans-serif;margin-top:10px;">${sendDate}</div>
      </td></tr>
      <tr><td style="background:${COLORS.cream};padding:12px 32px;border-bottom:1px solid #E8E0D0;font-size:12px;color:${COLORS.muted};font-family:Arial,sans-serif;text-transform:uppercase;letter-spacing:0.08em;">
        ${trends.length} non-Reel trends &middot; ${carousels.length} carousel &middot; ${statics.length} static
      </td></tr>
      <tr><td style="padding:26px 24px;background:${COLORS.bg};">
        ${section('Carousels', COLORS.carousel, carousels)}
        ${section('Statics', COLORS.static, statics)}
        ${trends.length === 0 ? `<div style="text-align:center;color:${COLORS.muted};font-size:13px;font-family:Arial,sans-serif;padding:30px 0;">No static or carousel trends this week.</div>` : ''}
      </td></tr>
      <tr><td style="background:${COLORS.navy};padding:22px 32px;text-align:center;">
        <div style="font-size:11px;color:#8A9CC0;font-family:Arial,sans-serif;">Static &amp; Carousel digest &middot; Pernod Ricard Middle East &middot; sent every Monday</div>
      </td></tr>
    </table>
  </td></tr></table>
</body>
</html>`
}
