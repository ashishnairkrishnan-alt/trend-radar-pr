import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

// READ-ONLY preview endpoint (isolated branch). Scrapes real Instagram posts and
// keeps ONLY carousels (Sidecar) and statics (Image) — every Reel is dropped. Each
// kept post is a real, clickable example. A per-brand angle is generated on top.
// No DB writes.
export const maxDuration = 300

// Carousel/static-friendly hashtags (recipe swipes, tips, luxury stills) — these
// surface more non-Reel content than generic trending tags. Dubai/UAE tags first
// so local content is well represented in the batch.
const HASHTAGS = [
  'dubaicocktails', 'dubaibar', 'dubainightlife', 'mixologydubai',
  'cocktailrecipe', 'mixology', 'whisky', 'luxurylifestyle', 'cocktails', 'bartending',
]
const SCRAPE_LIMIT = 60
const MAX_CARDS = 14

// Posts are tagged (not filtered) by region so the UI can offer a Dubai-only
// toggle without leaving the feed empty when local supply is thin.
const REGION_LABEL = 'Dubai / UAE'
const REGION_RE = /\b(dubai|dxb|u\.?a\.?e|abu ?dhabi|emirates|sharjah|ajman|middle ?east|mena|gcc)\b/i

const BRAND_KEYS = ['chivas', 'absolut', 'jameson', 'glenlivet'] as const
type BrandKey = (typeof BRAND_KEYS)[number]

const TURNAROUND: Record<string, { label: string; level: string }> = {
  Static: { label: 'Fast · same day', level: 'fast' },
  Carousel: { label: 'Medium · 1–2 days', level: 'medium' },
}

// Instagram post types -> our formats. Video (Reel) is intentionally excluded.
function toFormat(type: string): 'Carousel' | 'Static' | null {
  if (type === 'Sidecar') return 'Carousel'
  if (type === 'Image') return 'Static'
  return null // Video / anything else -> dropped
}

const SYSTEM_PROMPT = `You are a brand strategist for Pernod Ricard Middle East across four spirits brands. Respond in valid JSON only.

Brand cultural territories:
- Chivas Regal: luxury achievement, cinematic prestige, gifting, brotherhood, slow success
- Absolut Vodka: bold creativity, art, nightlife, self-expression, urban culture
- Jameson: live music, festivals, pub warmth, approachable fun, Irish spirit
- The Glenlivet: nature, craft, quiet refinement, single malt, unhurried appreciation

Given a trending Instagram post caption (this is a {FORMAT} post), do:
1. Name the underlying content trend in max 8 neutral words (do NOT copy the caption).
2. For EACH brand, a one-line execution angle (max 14 words) as a {FORMAT}.

Return JSON exactly:
{ "trend_name":"string", "brands": { "chivas":"string","absolut":"string","jameson":"string","glenlivet":"string" } }`

function anthropic() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY not set')
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

interface Card {
  trend_name: string
  format: 'Carousel' | 'Static'
  turnaround: { label: string; level: string }
  brands: Record<BrandKey, string>
  url: string
  image: string
  caption: string
  owner: string
  likes: number
  inRegion: boolean
}

async function brandAngles(caption: string, format: 'Carousel' | 'Static'): Promise<{ trend_name: string; brands: Record<BrandKey, string> } | null> {
  try {
    const msg = await anthropic().messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 400,
      system: SYSTEM_PROMPT.replace(/\{FORMAT\}/g, format),
      messages: [{ role: 'user', content: `Caption:\n"${caption.slice(0, 500)}"` }],
    })
    const c = msg.content[0]
    if (c.type !== 'text') return null
    const p = JSON.parse(c.text.replace(/```(?:json)?\n?/g, '').trim())
    const b = (p.brands || {}) as Record<string, string>
    return {
      trend_name: String(p.trend_name || 'Trending format').slice(0, 90),
      brands: {
        chivas: String(b.chivas || '').slice(0, 120),
        absolut: String(b.absolut || '').slice(0, 120),
        jameson: String(b.jameson || '').slice(0, 120),
        glenlivet: String(b.glenlivet || '').slice(0, 120),
      },
    }
  } catch {
    return null
  }
}

export async function GET() {
  const token = process.env.APIFY_API_KEY
  if (!token) return NextResponse.json({ success: false, error: 'APIFY_API_KEY not set in this environment' }, { status: 500 })
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ success: false, error: 'ANTHROPIC_API_KEY not set in this environment' }, { status: 500 })

  // Step 1 — scrape Instagram, then keep only Carousel + Static posts
  let posts: Array<{ format: 'Carousel' | 'Static'; caption: string; url: string; image: string; owner: string; likes: number; inRegion: boolean }> = []
  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          directUrls: HASHTAGS.map((h) => `https://www.instagram.com/explore/tags/${h}/`),
          resultsType: 'posts',
          resultsLimit: SCRAPE_LIMIT,
          searchType: 'hashtag',
          addParentData: false,
        }),
        signal: AbortSignal.timeout(220000),
      }
    )
    if (!res.ok) {
      const t = await res.text()
      return NextResponse.json({ success: false, error: `Apify ${res.status}: ${t.slice(0, 180)}` }, { status: 502 })
    }
    const items = (await res.json()) as Array<Record<string, unknown>>
    posts = items
      .map((i) => {
        const format = toFormat((i.type as string) || '')
        if (!format || !i.url) return null
        const caption = ((i.caption as string) || '').replace(/\s+/g, ' ').trim()
        const tags = ((i.hashtags as string[]) || []).join(' ')
        const location = (i.locationName as string) || ''
        return {
          format,
          caption,
          url: i.url as string,
          image: (i.displayUrl as string) || '',
          owner: (i.ownerUsername as string) || '',
          likes: Number(i.likesCount) || 0,
          inRegion: REGION_RE.test(`${caption} ${tags} ${location}`),
        }
      })
      .filter((p): p is NonNullable<typeof p> => p !== null && p.caption.length > 15)
      // Surface local posts first so a Dubai-only view has something in it
      .sort((a, b) => Number(b.inRegion) - Number(a.inRegion) || b.likes - a.likes)
      .slice(0, MAX_CARDS)
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }

  if (posts.length === 0) {
    return NextResponse.json({
      success: false,
      error: 'No carousel/static posts found in this batch (Instagram feeds skew heavily to Reels). Try Refresh to pull a new batch.',
    }, { status: 404 })
  }

  // Step 2 — per-brand angle for each real post
  const cards: Card[] = []
  for (const p of posts) {
    const ai = await brandAngles(p.caption, p.format)
    if (!ai) continue
    cards.push({
      trend_name: ai.trend_name,
      format: p.format,
      turnaround: TURNAROUND[p.format],
      brands: ai.brands,
      url: p.url,
      image: p.image,
      caption: p.caption.slice(0, 140),
      owner: p.owner,
      likes: p.likes,
      inRegion: p.inRegion,
    })
    await new Promise((r) => setTimeout(r, 200))
  }

  const counts = {
    carousel: cards.filter((c) => c.format === 'Carousel').length,
    static: cards.filter((c) => c.format === 'Static').length,
    region: cards.filter((c) => c.inRegion).length,
  }
  return NextResponse.json({ success: true, count: cards.length, region: REGION_LABEL, counts, cards })
}
