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

// A real Instagram post by a real account that uses this trend
interface Example {
  title: string
  link: string
  source: string
  thumbnail: string
}

interface Trend {
  trend_name: string
  description: string
  keyword: string
  format: 'Carousel' | 'Static'
  turnaround: { label: string; level: string }
  brands: Record<BrandKey, string>
  links: { google: string; pinterest: string; instagramTag: string }
  hashtag: string
  examples: Example[]
  slideImage?: string
}

// Which roundup is this, and therefore what format do its trends take?
function detectFormat(caption: string): 'Static' | 'Carousel' | null {
  const c = (caption || '').toLowerCase()
  if (/single\s*post\s*trends/.test(c)) return 'Static'
  if (/carousel\s*trends/.test(c)) return 'Carousel'
  return null
}

// NOTE: hashtag URLs (/explore/tags/redflagscarousel) reliably return "No results"
// for these trends — they're layout names, not topics anyone hashtags. Use
// Instagram's full-text keyword search instead, and lead with Google, which is by
// far the most dependable way to find write-ups and real examples of a format.
// Text search is a weak fallback for these trends (they're layouts, not topics —
// hashtag and keyword searches reliably return nothing). Real examples come from
// Google Lens visual matching on the slide image instead; these remain as backup.
function buildLinks(keyword: string) {
  const kw = (keyword || '').trim()
  // udm=2 is Google's current Images tab (tbm=isch is legacy and can render oddly).
  // Keep the query short — extra words like "post trend examples" kill the results.
  return {
    google: `https://www.google.com/search?udm=2&q=${encodeURIComponent(`${kw} instagram`)}`,
    pinterest: `https://www.pinterest.com/search/pins/?q=${encodeURIComponent(kw)}`,
  }
}

// Reverse-image search a slide to find real posts that use the same layout.
// This is the reliable path: layout trends are visual, so match them visually.
// Scrape the real hashtags behind these trends in ONE call, then match posts back
// to each trend by the hashtags the post itself carries. Every result is a real
// post by a real account, so the link is accurate by construction.
async function fetchExamplesByHashtag(
  hashtags: string[],
  token: string,
  diag: string[]
): Promise<Record<string, Example[]>> {
  const out: Record<string, Example[]> = {}
  const tags = Array.from(new Set(hashtags.filter(Boolean))).slice(0, 10)
  if (tags.length === 0) return out

  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          directUrls: tags.map((t) => `https://www.instagram.com/explore/tags/${t}/`),
          resultsType: 'posts',
          resultsLimit: 60,
          searchType: 'hashtag',
          addParentData: false,
        }),
        signal: AbortSignal.timeout(150000),
      }
    )
    if (!res.ok) {
      diag.push(`examples HTTP ${res.status}: ${(await res.text()).slice(0, 120)}`)
      return out
    }
    const items = (await res.json()) as Array<Record<string, unknown>>
    diag.push(`scraped ${items.length} posts across ${tags.length} tags`)

    for (const tag of tags) {
      const matches = items
        .filter((i) => {
          if (!i.url) return false
          // Only carousels and statics — no Reels
          if (i.type !== 'Sidecar' && i.type !== 'Image') return false
          const tagList = ((i.hashtags as string[]) || []).map((h) => h.toLowerCase())
          return tagList.includes(tag)
        })
        .sort((a, b) => (Number(b.likesCount) || 0) - (Number(a.likesCount) || 0))
        .slice(0, 3)
        .map((i) => ({
          title: ((i.caption as string) || '').replace(/\s+/g, ' ').slice(0, 70) || 'Instagram post',
          link: i.url as string,
          source: `@${(i.ownerUsername as string) || 'instagram'} · ♥ ${(Number(i.likesCount) || 0).toLocaleString()}`,
          thumbnail: (i.displayUrl as string) || '',
        }))
      if (matches.length > 0) out[tag] = matches
    }
    return out
  } catch (err) {
    diag.push(`examples error: ${String(err).slice(0, 120)}`)
    return out
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
- hashtag: ONE real, widely-used Instagram hashtag where real people posting this kind of
  content can be found. It MUST be a hashtag that genuinely exists and is popular — prefer
  broad, established tags (e.g. "photodump", "summerbucketlist", "moodboard", "bestof2026").
  Do NOT invent compound tags like "fruityscrappyphotodumps". No # symbol, lowercase.
- slide_index: which image this trend came from, 1-based, in the order the images were given.

Return JSON only:
{ "trends": [ { "trend_name": "string", "description": "string", "keyword": "string", "hashtag": "string", "slide_index": 1 } ] }`

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
        // Map the trend back to the slide it was read from, for reverse-image search
        const idx = Number(t.slide_index) - 1
        const slideImage = idx >= 0 && idx < r.images.length ? r.images[idx] : undefined
        const hashtag = String(t.hashtag || '').toLowerCase().replace(/[^a-z0-9]/g, '')
        trends.push({
          hashtag,
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
          links: {
            ...buildLinks(keyword),
            instagramTag: hashtag ? `https://www.instagram.com/explore/tags/${hashtag}/` : '',
          },
          examples: [],
          slideImage,
        })
      }
    } catch { /* skip this roundup */ }
  }

  if (trends.length === 0) {
    return NextResponse.json({ success: false, error: 'Could not read any trends from the roundup slides.' }, { status: 404 })
  }

  // Step 3 — reverse-image search each slide to find real posts using the same
  // layout. Run in parallel and cap the count to stay inside the time budget.
  const lensDiag: string[] = []
  const byTag = await fetchExamplesByHashtag(trends.map((t) => t.hashtag), token, lensDiag)
  for (const t of trends) {
    t.examples = byTag[t.hashtag] || []
  }

  // Never return the source slide image to the client
  const clean = trends.map(({ slideImage: _slideImage, ...rest }) => rest)

  const counts = {
    static: trends.filter((t) => t.format === 'Static').length,
    carousel: trends.filter((t) => t.format === 'Carousel').length,
    withExamples: trends.filter((t) => t.examples.length > 0).length,
  }
  return NextResponse.json({
    success: true,
    count: clean.length,
    counts,
    hashtagsUsed: Array.from(new Set(trends.map((t) => t.hashtag).filter(Boolean))),
    lensDiag: lensDiag.slice(0, 6),
    trends: clean,
  })
}
