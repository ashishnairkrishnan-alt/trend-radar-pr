import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

// READ-ONLY preview endpoint (isolated branch).
//
// The discovery account posts monthly roundup carousels where EACH SLIDE is one
// trend, with its name in large text on the image — the caption is only SEO
// keywords and CTAs. So we read the SLIDE IMAGES with vision to get the real
// trend names, then hand back independent search links so the team can find
// their own examples. The source account's handle, caption and post are never
// shown or linked. No DB writes.
export const maxDuration = 300

const DISCOVERY_PROFILE = 'holler.academy' // scout only — never displayed
const MAX_SLIDES_PER_POST = 9
const MAX_ROUNDUPS = 2

const BRAND_KEYS = ['chivas', 'absolut', 'jameson', 'glenlivet'] as const
type BrandKey = (typeof BRAND_KEYS)[number]

const TURNAROUND: Record<string, { label: string; level: string }> = {
  Static: { label: 'Fast · same day', level: 'fast' },
  Carousel: { label: 'Medium · 1–2 days', level: 'medium' },
}

function anthropic() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set')
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

interface Trend {
  trend_name: string
  description: string
  keyword: string
  format: 'Carousel' | 'Static'
  turnaround: { label: string; level: string }
  brands: Record<BrandKey, string>
  links: { instagram: string; google: string; pinterest: string }
}

// Which roundup is this, and therefore what format do its trends take?
function detectFormat(caption: string): 'Static' | 'Carousel' | null {
  const c = (caption || '').toLowerCase()
  if (/single\s*post\s*trends/.test(c)) return 'Static'
  if (/carousel\s*trends/.test(c)) return 'Carousel'
  return null
}

function buildLinks(keyword: string) {
  const kw = (keyword || '').trim()
  const tag = kw.replace(/[^a-z0-9]/gi, '')
  return {
    instagram: tag ? `https://www.instagram.com/explore/tags/${tag}/` : 'https://www.instagram.com/explore/',
    google: `https://www.google.com/search?q=${encodeURIComponent(`"${kw}" instagram post trend`)}`,
    pinterest: `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(kw)}`,
  }
}

// Fetch a slide image and inline it for the vision call
async function toImageBlock(url: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) })
  if (!res.ok) throw new Error(`image ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  return {
    type: 'image' as const,
    source: { type: 'base64' as const, media_type: 'image/jpeg' as const, data: buf.toString('base64') },
  }
}

const VISION_PROMPT = `These images are slides from a monthly Instagram trend roundup. EACH slide shows ONE trending post format: its NAME is in large text, with a short description underneath.

Extract every real trend. Rules:
- SKIP cover slides (e.g. "Trending Single Posts July 2026"), intro slides, and pure CTA slides ("comment TEMPLATE", "follow for more", "free masterclass").
- trend_name: the name shown on the slide, tidied to Title Case (e.g. "iOS Moodboards", "6 Months Left Timeline").
- description: one plain sentence (max 20 words) explaining what the format is, in your own words.
- keyword: 1-3 lowercase words to search for real examples (e.g. "ios moodboard").

Return JSON only:
{ "trends": [ { "trend_name": "string", "description": "string", "keyword": "string" } ] }`

const BRAND_PROMPT = `You are a brand strategist for Pernod Ricard Middle East. Respond in valid JSON only.

Brand territories:
- Chivas Regal: luxury achievement, cinematic prestige, gifting, brotherhood
- Absolut Vodka: bold creativity, art, nightlife, self-expression, urban culture
- Jameson: live music, festivals, pub warmth, approachable fun
- The Glenlivet: nature, craft, quiet refinement, single malt

For each trend given, write a one-line execution angle (max 14 words) per brand, as a {FORMAT} post.

Return JSON only:
{ "results": [ { "trend_name":"string", "chivas":"string","absolut":"string","jameson":"string","glenlivet":"string" } ] }`

export async function GET() {
  const token = process.env.APIFY_API_KEY
  if (!token) return NextResponse.json({ success: false, error: 'APIFY_API_KEY not set' }, { status: 500 })
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ success: false, error: 'ANTHROPIC_API_KEY not set' }, { status: 500 })

  // Step 1 — find the roundup posts and collect their slide images
  const roundups: { format: 'Static' | 'Carousel'; images: string[] }[] = []
  try {
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
    if (!res.ok) {
      const t = await res.text()
      return NextResponse.json({ success: false, error: `Apify ${res.status}: ${t.slice(0, 180)}` }, { status: 502 })
    }
    const items = (await res.json()) as Array<Record<string, unknown>>

    for (const i of items) {
      const format = detectFormat((i.caption as string) || '')
      if (!format) continue
      const children = (i.childPosts as Array<Record<string, unknown>>) || []
      const images = children
        .map((c) => (c.displayUrl as string) || '')
        .filter(Boolean)
        .slice(0, MAX_SLIDES_PER_POST)
      // Fall back to the cover image only if there are no child slides
      if (images.length === 0 && i.displayUrl) images.push(i.displayUrl as string)
      if (images.length > 0) roundups.push({ format, images })
      if (roundups.length >= MAX_ROUNDUPS) break
    }
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }

  if (roundups.length === 0) {
    return NextResponse.json({
      success: false,
      error: 'No "Single Post Trends" or "Carousel Trends" roundup found in recent posts.',
    }, { status: 404 })
  }

  // Step 2 — read the slides with vision, then add per-brand angles
  const trends: Trend[] = []
  for (const r of roundups) {
    try {
      const blocks = []
      for (const url of r.images) {
        try { blocks.push(await toImageBlock(url)) } catch { /* skip unreadable slide */ }
      }
      if (blocks.length === 0) continue

      const visionMsg = await anthropic().messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        messages: [{ role: 'user', content: [...blocks, { type: 'text', text: VISION_PROMPT }] }],
      })
      const vc = visionMsg.content[0]
      if (vc.type !== 'text') continue
      const parsed = JSON.parse(vc.text.replace(/```(?:json)?\n?/g, '').trim())
      const list = (Array.isArray(parsed.trends) ? parsed.trends : []) as Array<Record<string, string>>
      if (list.length === 0) continue

      // Brand angles for this batch
      const angles: Record<string, Record<string, string>> = {}
      try {
        const bm = await anthropic().messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 1500,
          system: BRAND_PROMPT.replace('{FORMAT}', r.format),
          messages: [{
            role: 'user',
            content: list.map((t) => `- ${t.trend_name}: ${t.description}`).join('\n'),
          }],
        })
        const bc = bm.content[0]
        if (bc.type === 'text') {
          const bp = JSON.parse(bc.text.replace(/```(?:json)?\n?/g, '').trim())
          for (const row of (bp.results || []) as Array<Record<string, string>>) {
            angles[row.trend_name] = row
          }
        }
      } catch { /* angles are optional */ }

      for (const t of list) {
        const a = angles[t.trend_name] || {}
        const keyword = String(t.keyword || t.trend_name || '').toLowerCase()
        trends.push({
          trend_name: String(t.trend_name || '').slice(0, 90),
          description: String(t.description || '').slice(0, 160),
          keyword,
          format: r.format,
          turnaround: TURNAROUND[r.format],
          brands: {
            chivas: String(a.chivas || '').slice(0, 120),
            absolut: String(a.absolut || '').slice(0, 120),
            jameson: String(a.jameson || '').slice(0, 120),
            glenlivet: String(a.glenlivet || '').slice(0, 120),
          },
          links: buildLinks(keyword),
        })
      }
    } catch { /* skip this roundup */ }
  }

  if (trends.length === 0) {
    return NextResponse.json({ success: false, error: 'Could not read any trends from the roundup slides.' }, { status: 404 })
  }

  const counts = {
    static: trends.filter((t) => t.format === 'Static').length,
    carousel: trends.filter((t) => t.format === 'Carousel').length,
  }
  return NextResponse.json({ success: true, count: trends.length, counts, trends })
}
