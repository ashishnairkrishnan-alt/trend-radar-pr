import Anthropic from '@anthropic-ai/sdk'
import { dedupeByName } from './dedupe'

// Shared generator for Static & Carousel trends. Reads a monthly roundup account's
// SLIDE IMAGES with vision to get real trend names, then scores each trend's fit
// per brand (1-5) and writes a DISTINCT angle per brand. Used by both the preview
// page (/api/preview-formats) and the Monday static/carousel email, so they stay
// in sync. Read-only against Instagram — no DB writes here.

const DISCOVERY_PROFILE = 'holler.academy' // scout only, never displayed
const MAX_SLIDES_PER_POST = 12
const MAX_ROUNDUPS = 2

export const FORMAT_BRAND_KEYS = ['chivas', 'absolut', 'jameson', 'glenlivet'] as const
export type FormatBrandKey = (typeof FORMAT_BRAND_KEYS)[number]

const TURNAROUND: Record<string, { label: string; level: string }> = {
  Static: { label: 'Fast · same day', level: 'fast' },
  Carousel: { label: 'Medium · 1-2 days', level: 'medium' },
}

export interface FormatTrendBrand {
  score: number
  angle: string
}

export interface FormatTrend {
  trend_name: string
  description: string
  format: 'Carousel' | 'Static'
  turnaround: { label: string; level: string }
  top_brand: FormatBrandKey
  brands: Record<FormatBrandKey, FormatTrendBrand>
  googleImages: string
}

function anthropic() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set')
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

function clean(s: string): string {
  return (s || '').replace(/\s*[—–]\s*/g, ' - ').replace(/\s+/g, ' ').trim()
}

function normName(s: string): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9]/g, '')
}

function detectFormat(caption: string): 'Static' | 'Carousel' | null {
  const c = (caption || '').toLowerCase()
  if (/single\s*post\s*trends/.test(c)) return 'Static'
  if (/carousel\s*trends/.test(c)) return 'Carousel'
  return null
}

function googleImagesLink(trendName: string): string {
  return `https://www.google.com/search?udm=2&q=${encodeURIComponent(`${trendName} instagram trend`)}`
}

async function toImageBlock(url: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`image ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  return {
    type: 'image' as const,
    source: { type: 'base64' as const, media_type: 'image/jpeg' as const, data: buf.toString('base64') },
  }
}

const VISION_PROMPT = `These images are slides from a monthly Instagram trend roundup. Most slides show ONE specific trending post format - a NAME in large text plus a short "here's how/why it works" description. Some slides are NOT trends and must be skipped.

ONLY extract a slide if it is a specific, nameable CONTENT TREND you could recreate (e.g. "iOS Moodboards", "6 Months Left Timeline", "Wordsearch Post").

SKIP any slide that is NOT a single trend, including:
- Cover / title slides ("Trending Single Posts July 2026", "Trending Carousels")
- Intro, outro, and pure CTA slides ("comment TEMPLATE", "follow for more", "free masterclass", "30 days free")
- Menu / contents / agenda slides that just LIST categories
- Slides that name a PRODUCT, TEMPLATE, TOOL or the creator's offer rather than a content trend
- Anything generic ("Single Posts", "Carousel Posts") that is a format category, not a specific named trend

Rules:
- trend_name: the EXACT name on the slide, tidied to Title Case. Do not invent, rephrase, or use dashes.
- description: one plain sentence (max 20 words), your own words, no dashes.
- If a slide is ambiguous or looks like a menu/product/CTA, leave it OUT. Fewer clean trends beats junk.

Return JSON only:
{ "trends": [ { "trend_name": "string", "description": "string" } ] }`

// Per-brand FIT scoring + distinct angles — this is what stops every brand looking
// the same. Each trend genuinely fits some brands more than others.
const BRAND_PROMPT = `You are a brand strategist for Pernod Ricard Middle East. Respond in valid JSON only.

The four brands live in DISTINCT worlds:
- Chivas Regal: luxury achievement, cinematic prestige, gifting, brotherhood, slow success
- Absolut Vodka: bold creativity, art, nightlife, self-expression, urban culture, loud aesthetics
- Jameson: live music, festivals, pubs, warmth, approachable everyday fun, Irish spirit
- The Glenlivet: nature, craft, quiet refinement, single malt, unhurried appreciation

For each trend you are given, for EACH brand return:
- "score": 1-5, how NATURALLY that brand could own this specific trend. Be discriminating: most trends fit one or two brands well and others poorly. Do NOT give everything 4s and 5s.
- "angle": one line (max 14 words) that is UNMISTAKABLY that brand's world. Never reuse phrasing across brands; if a brand fits poorly, say how it would adapt or keep it minimal.
Also return "top_brand": the single best-fit brand key ("chivas" | "absolut" | "jameson" | "glenlivet").

Return JSON only:
{ "results": [ { "trend_name":"string", "top_brand":"chivas|absolut|jameson|glenlivet",
  "chivas":{"score":1,"angle":"string"}, "absolut":{"score":1,"angle":"string"},
  "jameson":{"score":1,"angle":"string"}, "glenlivet":{"score":1,"angle":"string"} } ] }`

function coerceScore(v: unknown): number {
  const n = Math.round(Number(v))
  if (!isFinite(n) || n < 1) return 1
  if (n > 5) return 5
  return n
}

export async function generateFormatTrends(): Promise<FormatTrend[]> {
  const token = process.env.APIFY_API_KEY
  if (!token) throw new Error('APIFY_API_KEY not set')
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set')

  // Step 1 — find roundup posts + collect slide images
  const res = await fetch(
    `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${token}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        directUrls: [`https://www.instagram.com/${DISCOVERY_PROFILE}/`],
        resultsType: 'posts',
        resultsLimit: 16,
        addParentData: false,
      }),
      signal: AbortSignal.timeout(180000),
    }
  )
  if (!res.ok) throw new Error(`Apify ${res.status}: ${(await res.text()).slice(0, 180)}`)
  const items = (await res.json()) as Array<Record<string, unknown>>

  const roundups: { format: 'Static' | 'Carousel'; images: string[] }[] = []
  for (const i of items) {
    const format = detectFormat((i.caption as string) || '')
    if (!format) continue
    const children = (i.childPosts as Array<Record<string, unknown>>) || []
    const images = children.map((c) => (c.displayUrl as string) || '').filter(Boolean).slice(0, MAX_SLIDES_PER_POST)
    if (images.length === 0 && i.displayUrl) images.push(i.displayUrl as string)
    if (images.length > 0) roundups.push({ format, images })
    if (roundups.length >= MAX_ROUNDUPS) break
  }
  if (roundups.length === 0) throw new Error('No "Single Post Trends" or "Carousel Trends" roundup found')

  // Step 2 — vision reads slides, then per-brand fit scoring
  const trends: FormatTrend[] = []
  for (const r of roundups) {
    try {
      const blocks = []
      for (const url of r.images) {
        try { blocks.push(await toImageBlock(url)) } catch { /* skip unreadable slide */ }
      }
      if (blocks.length === 0) continue

      const visionMsg = await anthropic().messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1200,
        messages: [{ role: 'user', content: [...blocks, { type: 'text', text: VISION_PROMPT }] }],
      })
      const vc = visionMsg.content[0]
      if (vc.type !== 'text') continue
      const parsed = JSON.parse(vc.text.replace(/```(?:json)?\n?/g, '').trim())
      const list = (Array.isArray(parsed.trends) ? parsed.trends : []) as Array<Record<string, string>>
      if (list.length === 0) continue

      const byName: Record<string, Record<string, unknown>> = {}
      let inOrder: Array<Record<string, unknown>> = []
      try {
        const bm = await anthropic().messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 2200,
          system: BRAND_PROMPT,
          messages: [{ role: 'user', content: `Format: ${r.format}\n` + list.map((t, i) => `${i + 1}. ${t.trend_name}: ${t.description}`).join('\n') }],
        })
        const bc = bm.content[0]
        if (bc.type === 'text') {
          const bp = JSON.parse(bc.text.replace(/```(?:json)?\n?/g, '').trim())
          inOrder = (bp.results || []) as Array<Record<string, unknown>>
          for (const row of inOrder) byName[normName(String(row.trend_name || ''))] = row
        }
      } catch { /* angles optional */ }

      list.forEach((t, i) => {
        const trend_name = clean(String(t.trend_name || '')).slice(0, 90)
        if (!trend_name) return
        const row = byName[normName(trend_name)] || inOrder[i] || {}
        const brand = (k: FormatBrandKey): FormatTrendBrand => {
          const b = (row[k] || {}) as Record<string, unknown>
          return { score: coerceScore(b.score), angle: clean(String(b.angle || '')).slice(0, 120) }
        }
        const brands = {
          chivas: brand('chivas'), absolut: brand('absolut'),
          jameson: brand('jameson'), glenlivet: brand('glenlivet'),
        }
        // Trust the model's top_brand if valid, else derive from the scores
        const rawTop = String(row.top_brand || '')
        let top_brand: FormatBrandKey = FORMAT_BRAND_KEYS.includes(rawTop as FormatBrandKey)
          ? (rawTop as FormatBrandKey)
          : 'chivas'
        for (const k of FORMAT_BRAND_KEYS) {
          if (brands[k].score > brands[top_brand].score) top_brand = k
        }
        trends.push({
          trend_name,
          description: clean(String(t.description || '')).slice(0, 160),
          format: r.format,
          turnaround: TURNAROUND[r.format],
          top_brand,
          brands,
          googleImages: googleImagesLink(trend_name),
        })
      })
    } catch { /* skip this roundup */ }
  }

  // Collapse near-duplicate trends (reworded versions of the same idea)
  return dedupeByName(trends, (t) => t.trend_name)
}
