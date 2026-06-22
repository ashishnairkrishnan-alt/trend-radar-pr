import { APIFY_ACTORS, KEYWORD_CLUSTERS } from './config'

const APIFY_BASE = 'https://api.apify.com/v2'

interface ActorRunResult {
  actorId: string
  runId: string
  status: string
}

function getWebhookUrl(): string {
  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  const secret = process.env.APIFY_WEBHOOK_SECRET || ''
  return `${appUrl}/api/ingest?secret=${encodeURIComponent(secret)}`
}

async function runActor(actorId: string, input: Record<string, unknown>): Promise<ActorRunResult> {
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
        webhooks: [{ eventTypes: ['ACTOR.RUN.SUCCEEDED'], requestUrl: webhookUrl }],
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
  return { actorId, runId: run.id, status: run.status }
}

export async function triggerAllScrapers(): Promise<ActorRunResult[]> {
  const allKeywords = Object.values(KEYWORD_CLUSTERS).flat()
  const results: ActorRunResult[] = []

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

  console.log(`[apify] Started ${results.length}/2 scrapers`)
  return results
}

export async function fetchDatasetItems(datasetId: string): Promise<unknown[]> {
  const apiKey = process.env.APIFY_API_KEY!
  const response = await fetch(
    `${APIFY_BASE}/datasets/${datasetId}/items?token=${apiKey}&format=json`,
    { method: 'GET' }
  )
  if (!response.ok) throw new Error(`Failed to fetch dataset ${datasetId}: ${response.status}`)
  return response.json()
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface NormalisedTrend {
  platform: 'instagram' | 'tiktok'
  trend_name: string
  trend_type: 'audio' | 'format' | 'hashtag'
  emotional_hook: string
  engagement_volume: number
  spike_pct: number
  source_url: string
  raw_data: Record<string, unknown>
}

function safeNum(val: unknown, fallback = 0): number {
  const n = Number(val)
  return isFinite(n) ? n : fallback
}

// ─── TikTok: aggregate videos by hashtag ────────────────────────────────────
// clockworks/tiktok-scraper returns individual videos.
// We group them by hashtag and rank by total views + like count.
export function aggregateHashtagTrends(items: Record<string, unknown>[]): NormalisedTrend[] {
  type Entry = {
    name: string
    videoCount: number
    totalViews: number
    totalLikes: number
    bestUrl: string
    bestViews: number
    bestCaption: string
  }

  const map = new Map<string, Entry>()

  for (const item of items) {
    const hashtags = (item.hashtags as Array<{ name?: string }> | undefined) || []
    const stats = item.stats as Record<string, number> | undefined
    const views = safeNum(stats?.playCount)
    const likes = safeNum(stats?.diggCount)

    const videoId = item.id as string
    const authorName = (item.authorMeta as Record<string, string>)?.name || 'unknown'
    const videoUrl =
      (item.webVideoUrl as string) ||
      (videoId ? `https://www.tiktok.com/@${authorName}/video/${videoId}` : '')
    const caption = ((item.text as string) || '').slice(0, 200)

    for (const tag of hashtags) {
      const name = tag.name?.toLowerCase().trim()
      if (!name || name.length < 2) continue

      const existing = map.get(name)
      if (existing) {
        existing.videoCount++
        existing.totalViews += views
        existing.totalLikes += likes
        if (views > existing.bestViews) {
          existing.bestViews = views
          existing.bestUrl = videoUrl
          existing.bestCaption = caption
        }
      } else {
        map.set(name, {
          name,
          videoCount: 1,
          totalViews: views,
          totalLikes: likes,
          bestUrl: videoUrl,
          bestViews: views,
          bestCaption: caption,
        })
      }
    }
  }

  const trends: NormalisedTrend[] = []
  for (const entry of Array.from(map.values())) {
    if (entry.videoCount < 2) continue
    const engagementScore = entry.totalViews + entry.totalLikes * 5
    trends.push({
      platform: 'tiktok',
      trend_name: `#${entry.name}`,
      trend_type: 'hashtag',
      emotional_hook: entry.bestCaption || `#${entry.name} trending on TikTok`,
      engagement_volume: engagementScore,
      spike_pct: Math.min(Math.round(entry.videoCount * 25 + engagementScore / 10000), 999),
      source_url: entry.bestUrl,
      raw_data: { videoCount: entry.videoCount, totalViews: entry.totalViews, totalLikes: entry.totalLikes },
    })
  }

  return trends.sort((a, b) => b.engagement_volume - a.engagement_volume).slice(0, 8)
}

// ─── TikTok: aggregate trending audio ───────────────────────────────────────
// Music appearing in 2+ videos is considered trending.
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
    // clockworks/tiktok-scraper uses musicMeta
    const music = (item.musicMeta as Record<string, unknown>) || (item.music as Record<string, unknown>)
    if (!music) continue

    const musicId = (music.musicId as string) || (music.id as string)
    if (!musicId) continue

    const musicName = (music.musicName as string) || (music.title as string) || ''
    const musicAuthor = (music.musicAuthor as string) || (music.authorName as string) || ''
    if (!musicName) continue

    const stats = item.stats as Record<string, number> | undefined
    const views = safeNum(stats?.playCount)
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
    if (audio.count < 2) continue
    const label = audio.author ? `"${audio.name}" by ${audio.author}` : `"${audio.name}"`
    trends.push({
      platform: 'tiktok',
      trend_name: label,
      trend_type: 'audio',
      emotional_hook: `Trending audio used in ${audio.count} videos — ${audio.totalViews.toLocaleString()} total views`,
      engagement_volume: audio.totalViews,
      spike_pct: Math.min(audio.count * 15, 500),
      source_url: audio.bestVideoUrl,
      raw_data: { musicName: audio.name, musicAuthor: audio.author, videoCount: audio.count },
    })
  }

  return trends.sort((a, b) => b.spike_pct - a.spike_pct).slice(0, 4)
}

// ─── Instagram: aggregate posts by hashtag ───────────────────────────────────
// apify/instagram-hashtag-scraper returns individual posts.
// We group by hashtags found in captions and rank by total engagement.
export function aggregateInstagramHashtagTrends(items: Record<string, unknown>[]): NormalisedTrend[] {
  type Entry = {
    name: string
    postCount: number
    totalEngagement: number
    bestUrl: string
    bestEngagement: number
    bestCaption: string
  }

  const map = new Map<string, Entry>()

  for (const item of items) {
    const likes = safeNum(item.likesCount)
    const comments = safeNum(item.commentsCount)
    const views = safeNum(item.videoViewCount)
    const engagement = likes + comments * 3 + views

    const shortCode = item.shortCode as string
    const postUrl =
      (item.url as string) ||
      (shortCode ? `https://www.instagram.com/p/${shortCode}/` : '')
    const caption = ((item.caption as string) || '').slice(0, 200)

    // Hashtags come as array of strings or objects
    const rawTags = (item.hashtags as unknown[]) || []
    const tags: string[] = rawTags.map(t =>
      typeof t === 'string' ? t.toLowerCase().replace('#', '') : String(t).toLowerCase()
    ).filter(t => t.length > 1)

    for (const name of tags) {
      const existing = map.get(name)
      if (existing) {
        existing.postCount++
        existing.totalEngagement += engagement
        if (engagement > existing.bestEngagement) {
          existing.bestEngagement = engagement
          existing.bestUrl = postUrl
          existing.bestCaption = caption
        }
      } else {
        map.set(name, {
          name,
          postCount: 1,
          totalEngagement: engagement,
          bestUrl: postUrl,
          bestEngagement: engagement,
          bestCaption: caption,
        })
      }
    }
  }

  const trends: NormalisedTrend[] = []
  for (const entry of Array.from(map.values())) {
    if (entry.postCount < 2) continue
    trends.push({
      platform: 'instagram',
      trend_name: `#${entry.name}`,
      trend_type: 'hashtag',
      emotional_hook: entry.bestCaption || `#${entry.name} trending on Instagram`,
      engagement_volume: entry.totalEngagement,
      spike_pct: Math.min(Math.round(entry.totalEngagement / 500), 999),
      source_url: entry.bestUrl,
      raw_data: { postCount: entry.postCount, totalEngagement: entry.totalEngagement },
    })
  }

  return trends.sort((a, b) => b.engagement_volume - a.engagement_volume).slice(0, 8)
}

// Legacy single-item normalisers kept for the webhook-based ingest route
export function normaliseTikTokItem(item: Record<string, unknown>): NormalisedTrend | null {
  try {
    const hashtags = (item.hashtags as Array<{ name?: string }> | undefined) || []
    const firstTag = hashtags[0]?.name
    const trend_name = firstTag ? `#${firstTag}` : ((item.text as string)?.slice(0, 60) || '')
    if (!trend_name) return null

    const stats = item.stats as Record<string, number> | undefined
    const views = safeNum(stats?.playCount)
    const likes = safeNum(stats?.diggCount)

    const videoId = item.id as string
    const authorName = (item.authorMeta as Record<string, string>)?.name || 'unknown'
    const sourceUrl =
      (item.webVideoUrl as string) ||
      (videoId ? `https://www.tiktok.com/@${authorName}/video/${videoId}` : '')

    return {
      platform: 'tiktok',
      trend_name,
      trend_type: item.musicMeta ? 'audio' : 'hashtag',
      emotional_hook: ((item.text as string) || '').slice(0, 120) || 'Trending on TikTok',
      engagement_volume: views + likes,
      spike_pct: safeNum(typeof item.growthRate === 'number' ? (item.growthRate as number) * 100 : 0),
      source_url: sourceUrl,
      raw_data: {},
    }
  } catch {
    return null
  }
}

export function normaliseInstagramItem(item: Record<string, unknown>): NormalisedTrend | null {
  try {
    const rawTags = (item.hashtags as unknown[]) || []
    const firstTag = rawTags[0]
    const trend_name = firstTag
      ? `#${String(firstTag).toLowerCase().replace('#', '')}`
      : ((item.ownerUsername as string) || '')
    if (!trend_name) return null

    const likes = safeNum(item.likesCount)
    const comments = safeNum(item.commentsCount)
    const views = safeNum(item.videoViewCount)

    const shortCode = item.shortCode as string
    const sourceUrl =
      (item.url as string) ||
      (shortCode ? `https://www.instagram.com/p/${shortCode}/` : '')

    return {
      platform: 'instagram',
      trend_name,
      trend_type: item.isVideo ? 'format' : 'hashtag',
      emotional_hook: ((item.caption as string) || '').slice(0, 120) || 'Trending on Instagram',
      engagement_volume: likes + comments + views,
      spike_pct: 0,
      source_url: sourceUrl,
      raw_data: {},
    }
  } catch {
    return null
  }
}
