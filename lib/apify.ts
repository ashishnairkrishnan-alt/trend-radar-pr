import { APIFY_ACTORS, KEYWORD_CLUSTERS } from './config'

const APIFY_BASE = 'https://api.apify.com/v2'

interface ActorRunResult {
  actorId: string
  runId: string
  status: string
}

function getWebhookUrl(): string {
  // VERCEL_URL is auto-set by Vercel on every deployment (no https:// prefix)
  // NEXT_PUBLIC_APP_URL is the manual override (must include https://)
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  const secret = process.env.APIFY_WEBHOOK_SECRET || ''
  return `${appUrl}/api/ingest?secret=${encodeURIComponent(secret)}`
}

async function runActor(
  actorId: string,
  input: Record<string, unknown>
): Promise<ActorRunResult> {
  const apiKey = process.env.APIFY_API_KEY!
  const webhookUrl = getWebhookUrl()

  console.log(`[apify] Starting actor: ${actorId}`)

  const response = await fetch(
    `${APIFY_BASE}/acts/${encodeURIComponent(actorId)}/runs?token=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...input,
        // Apify webhook configuration
        webhooks: [
          {
            eventTypes: ['ACTOR.RUN.SUCCEEDED'],
            requestUrl: webhookUrl,
          },
        ],
      }),
    }
  )

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Apify API error ${response.status}: ${body}`)
  }

  const data = await response.json()
  const run = data.data

  console.log(`[apify] Actor ${actorId} started: runId=${run.id}, status=${run.status}`)

  return {
    actorId,
    runId: run.id,
    status: run.status,
  }
}

export async function triggerAllScrapers(): Promise<ActorRunResult[]> {
  const allKeywords = Object.values(KEYWORD_CLUSTERS).flat()
  const results: ActorRunResult[] = []

  // TikTok scraper — 10 results per keyword, no media downloads
  try {
    const tiktokResult = await runActor(APIFY_ACTORS.tiktokScraper, {
      hashtags: allKeywords,
      resultsPerPage: 10,
      shouldDownloadVideos: false,
      shouldDownloadCovers: false,
      shouldDownloadSubtitles: false,
      shouldDownloadSlideshowImages: false,
    })
    results.push(tiktokResult)
  } catch (err) {
    console.error('[apify] TikTok scraper failed:', err)
  }

  // Instagram hashtag scraper — 10 results per keyword
  try {
    const igHashtagResult = await runActor(APIFY_ACTORS.instagramHashtag, {
      hashtags: allKeywords,
      resultsLimit: 10,
      scrapeType: 'posts',
    })
    results.push(igHashtagResult)
  } catch (err) {
    console.error('[apify] Instagram hashtag scraper failed:', err)
  }

  // Note: Instagram reel scraper disabled to reduce Apify compute cost
  // Re-enable by uncommenting when on higher plan

  console.log(`[apify] Started ${results.length}/3 scrapers`)
  return results
}

export async function fetchDatasetItems(datasetId: string): Promise<unknown[]> {
  const apiKey = process.env.APIFY_API_KEY!

  const response = await fetch(
    `${APIFY_BASE}/datasets/${datasetId}/items?token=${apiKey}&format=json`,
    { method: 'GET' }
  )

  if (!response.ok) {
    throw new Error(`Failed to fetch dataset ${datasetId}: ${response.status}`)
  }

  return response.json()
}

// ─── Payload Normalisation ────────────────────────────────────────────────────
// Maps raw Apify items to the shape raw_trends expects

export interface NormalisedTrend {
  platform: 'instagram' | 'tiktok'
  trend_name: string
  trend_type: 'audio' | 'format' | 'hashtag'
  emotional_hook: string
  engagement_volume: number
  spike_pct: number
  source_url: string   // direct link to the specific video/post that triggered this trend
  raw_data: Record<string, unknown>
}

function safeJson(obj: unknown): Record<string, unknown> {
  try {
    return JSON.parse(JSON.stringify(obj, (_k, v) => {
      if (typeof v === 'number' && !isFinite(v)) return 0
      return v
    }))
  } catch {
    return {}
  }
}

function safeNum(val: unknown, fallback = 0): number {
  const n = Number(val)
  return isFinite(n) ? n : fallback
}

export function normaliseTikTokItem(item: Record<string, unknown>): NormalisedTrend | null {
  try {
    const hashtag = (item.challengeName as string) || (item.title as string) || ''
    if (!hashtag) return null

    const views = safeNum((item.stats as Record<string, number>)?.viewCount)
    const plays = safeNum((item.stats as Record<string, number>)?.playCount)
    const engagementVolume = Math.max(views, plays)

    const authorName = (item.authorMeta as Record<string, string>)?.name || 'unknown'
    const videoId = item.id as string
    const sourceUrl =
      (item.webVideoUrl as string) ||
      (videoId ? `https://www.tiktok.com/@${authorName}/video/${videoId}` : '')

    return {
      platform: 'tiktok',
      trend_name: hashtag,
      trend_type: item.music ? 'audio' : 'hashtag',
      emotional_hook: (item.desc as string)?.slice(0, 120) || 'Trending on TikTok',
      engagement_volume: engagementVolume,
      // growthRate rarely present — use view count as spike proxy (100k views ≈ 10% spike, cap 500%)
      spike_pct: safeNum(typeof item.growthRate === 'number'
        ? (item.growthRate as number) * 100
        : Math.min(Math.round(engagementVolume / 10000), 500)),
      source_url: sourceUrl,
      raw_data: {},
    }
  } catch {
    return null
  }
}

// Aggregates trending audio from a batch of raw TikTok items.
// Music appearing in 2+ videos is considered trending — no extra Apify credits needed.
export function aggregateAudioTrends(items: Record<string, unknown>[]): NormalisedTrend[] {
  type AudioEntry = {
    name: string
    author: string
    count: number
    totalViews: number
    bestVideoUrl: string
    bestVideoViews: number
  }
  const musicMap = new Map<string, AudioEntry>()

  for (const item of items) {
    const music = item.music as Record<string, unknown> | undefined
    if (!music) continue

    const musicId = (music.musicId as string) || (music.id as string)
    if (!musicId) continue

    const musicName = (music.musicName as string) || (music.title as string) || ''
    const musicAuthor = (music.musicAuthor as string) || (music.authorName as string) || ''
    if (!musicName) continue

    const stats = item.stats as Record<string, number> | undefined
    const views = stats?.viewCount || stats?.playCount || 0
    const videoId = item.id as string
    const authorName = (item.authorMeta as Record<string, string>)?.name || 'unknown'
    const videoUrl =
      (item.webVideoUrl as string) ||
      (videoId ? `https://www.tiktok.com/@${authorName}/video/${videoId}` : '')

    const existing = musicMap.get(musicId)
    if (existing) {
      existing.count++
      existing.totalViews += views
      if (views > existing.bestVideoViews) {
        existing.bestVideoViews = views
        existing.bestVideoUrl = videoUrl
      }
    } else {
      musicMap.set(musicId, {
        name: musicName,
        author: musicAuthor,
        count: 1,
        totalViews: views,
        bestVideoUrl: videoUrl,
        bestVideoViews: views,
      })
    }
  }

  const trends: NormalisedTrend[] = []
  for (const audio of Array.from(musicMap.values())) {
    if (audio.count < 2) continue // only truly recurring audio
    const label = audio.author ? `"${audio.name}" by ${audio.author}` : `"${audio.name}"`
    trends.push({
      platform: 'tiktok',
      trend_name: label,
      trend_type: 'audio',
      emotional_hook: `Trending audio used in ${audio.count} videos this week`,
      engagement_volume: audio.totalViews,
      spike_pct: Math.min(audio.count * 15, 500), // proxy: more videos = more spike, cap 500
      source_url: audio.bestVideoUrl,
      raw_data: {},
    })
  }

  // Return top 5 audio trends by spike_pct
  return trends.sort((a, b) => b.spike_pct - a.spike_pct).slice(0, 5)
}

// Aggregates Instagram posts by hashtag — returns one trend per hashtag
// using the highest-engagement post as the source URL
export function aggregateInstagramHashtags(items: Record<string, unknown>[]): NormalisedTrend[] {
  type HashtagEntry = {
    tag: string
    totalEngagement: number
    postCount: number
    bestPostUrl: string
    bestPostEngagement: number
    bestCaption: string
  }
  const tagMap = new Map<string, HashtagEntry>()

  for (const item of items) {
    const tag = (item.hashtag as string) || ''
    if (!tag) continue

    const likes = safeNum(item.likesCount)
    const comments = safeNum(item.commentsCount)
    const views = safeNum(item.videoViewCount)
    const engagement = likes + comments + views

    // Skip posts with zero engagement (likely private or irrelevant)
    if (engagement === 0) continue

    const shortCode = item.shortCode as string
    const postUrl =
      (item.url as string) ||
      (shortCode ? `https://www.instagram.com/p/${shortCode}/` : '')
    const caption = ((item.caption as string) || '').replace(/[\x00-\x1F\x7F]/g, ' ').slice(0, 120)

    const existing = tagMap.get(tag)
    if (existing) {
      existing.totalEngagement += engagement
      existing.postCount++
      if (engagement > existing.bestPostEngagement) {
        existing.bestPostEngagement = engagement
        existing.bestPostUrl = postUrl
        existing.bestCaption = caption
      }
    } else {
      tagMap.set(tag, {
        tag,
        totalEngagement: engagement,
        postCount: 1,
        bestPostUrl: postUrl,
        bestPostEngagement: engagement,
        bestCaption: caption,
      })
    }
  }

  const trends: NormalisedTrend[] = []
  for (const entry of Array.from(tagMap.values())) {
    if (entry.postCount < 2) continue // need at least 2 posts to call it a trend
    const tagLabel = entry.tag.startsWith('#') ? entry.tag : `#${entry.tag}`
    // Spike proxy: more posts + higher engagement = bigger spike, cap at 400
    const spike = Math.min(Math.round((entry.postCount * 10) + (entry.totalEngagement / 1000)), 400)
    trends.push({
      platform: 'instagram',
      trend_name: tagLabel,
      trend_type: 'hashtag',
      emotional_hook: entry.bestCaption || `Trending on Instagram with ${entry.postCount} posts`,
      engagement_volume: entry.totalEngagement,
      spike_pct: spike,
      source_url: entry.bestPostUrl,
      raw_data: {},
    })
  }

  // Top 8 hashtags by spike
  return trends.sort((a, b) => b.spike_pct - a.spike_pct).slice(0, 8)
}
