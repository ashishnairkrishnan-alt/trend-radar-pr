import { APIFY_ACTORS } from './config'

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

// ─── Scraper config ───────────────────────────────────────────────────────────
// Cultural lifestyle hashtags — not alcohol-specific.
// Goal: find what's trending in UAE that brands can authentically join.
const TIKTOK_HASHTAGS = [
  'dubai', 'abudhabi', 'dubainightlife', 'dubailife',
  'luxurylifestyle', 'uae', 'dubaievents', 'rooftop',
]

const INSTAGRAM_HASHTAGS = [
  'dubai', 'dubainightlife', 'dubailife', 'luxurylifestyle',
  'uae', 'dubaievents', 'abudhabi', 'rooftop',
]

// Only posts above these thresholds feed into aggregation.
// TikTok: views. Instagram: likes + comments*3.
export const MIN_POST_VIEWS = 50_000
export const MIN_IG_POST_ENGAGEMENT = 500

export async function triggerAllScrapers(): Promise<ActorRunResult[]> {
  const results: ActorRunResult[] = []

  try {
    const tt = await runActor(APIFY_ACTORS.tiktokScraper, {
      hashtags: TIKTOK_HASHTAGS,
      resultsPerPage: 50,
      shouldDownloadVideos: false,
      shouldDownloadCovers: false,
      shouldDownloadSubtitles: false,
      shouldDownloadSlideshowImages: false,
    })
    results.push({ ...tt, platform: 'tiktok' } as ActorRunResult)
  } catch (err) {
    console.error('[apify] TikTok scraper failed:', err)
  }

  try {
    const ig = await runActor(APIFY_ACTORS.instagramHashtag, {
      directUrls: INSTAGRAM_HASHTAGS.map(h => `https://www.instagram.com/explore/tags/${h}/`),
      resultsType: 'posts',
      resultsLimit: 30,
      onlyPostsNewerThan: '7 days',
    })
    results.push({ ...ig, platform: 'instagram' } as ActorRunResult)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[apify] Instagram scraper failed:', msg)
    results.push({ actorId: APIFY_ACTORS.instagramHashtag, runId: '', status: `ERROR: ${msg}`, platform: 'instagram' } as ActorRunResult)
  }

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

export interface TikTokPost {
  id: string
  text: string
  hashtags: Array<{ name: string; title?: string }>
  musicMeta: {
    musicId?: string
    musicName?: string
    musicAuthor?: string
    musicOriginal?: boolean
  }
  stats: {
    diggCount: number
    commentCount: number
    shareCount: number
    playCount: number
  }
  authorMeta: { name: string; nickName?: string }
  webVideoUrl?: string
  covers?: { default?: string; originCover?: string }
  createTime?: number
}

// ─── Engagement Scoring ───────────────────────────────────────────────────────

export function calcEngagement(item: Record<string, unknown>): number {
  // Trending-feed schema: stats are top-level, not nested under item.stats
  const likes = Number(item.diggCount) || 0
  const comments = Number(item.commentCount) || 0
  const shares = Number(item.shareCount) || 0
  const views = Number(item.playCount) || 0
  return (likes * 1) + (comments * 2) + (shares * 3) + (views / 1000)
}

// ─── TikTok Post Normalisation ────────────────────────────────────────────────
// Maps a raw trending-feed item to the shape used by the scoring pipeline.

export function normaliseTikTokPost(item: Record<string, unknown>): TikTokPost | null {
  try {
    const id = item.id as string
    if (!id) return null

    const authorMeta = (item.authorMeta as Record<string, string>) || {}
    const musicMeta = (item.musicMeta as Record<string, unknown>) || {}
    const hashtags = (item.hashtags as Array<{ name?: string; title?: string }> | undefined) || []
    const videoMeta = (item.videoMeta as Record<string, string>) || {}

    const videoUrl =
      (item.webVideoUrl as string) ||
      (id && authorMeta.name ? `https://www.tiktok.com/@${authorMeta.name}/video/${id}` : '')

    return {
      id,
      text: ((item.text as string) || '').slice(0, 300),
      hashtags: hashtags.filter(h => h.name).map(h => ({ name: h.name!, title: h.title })),
      musicMeta: {
        musicId: musicMeta.musicId as string,
        musicName: musicMeta.musicName as string,
        musicAuthor: musicMeta.musicAuthor as string,
        musicOriginal: musicMeta.musicOriginal as boolean,
      },
      stats: {
        diggCount: Number(item.diggCount) || 0,
        commentCount: Number(item.commentCount) || 0,
        shareCount: Number(item.shareCount) || 0,
        playCount: Number(item.playCount) || 0,
      },
      authorMeta: {
        name: authorMeta.name || 'unknown',
        nickName: authorMeta.nickName,
      },
      webVideoUrl: videoUrl,
      covers: {
        default: videoMeta.coverUrl,
        originCover: videoMeta.originalCoverUrl,
      },
    }
  } catch {
    return null
  }
}

// ─── Trend name + type derivation ─────────────────────────────────────────────

export function deriveTrendName(post: TikTokPost): string {
  const music = post.musicMeta
  if (music.musicOriginal === false && music.musicName) {
    return music.musicAuthor
      ? `"${music.musicName}" by ${music.musicAuthor}`
      : `"${music.musicName}"`
  }
  if (post.hashtags.length > 0) return `#${post.hashtags[0].name}`
  return post.text.slice(0, 60) || 'Trending video'
}

export function deriveTrendType(post: TikTokPost): 'audio' | 'hashtag' | 'format' {
  if (post.musicMeta.musicOriginal === false && post.musicMeta.musicName) return 'audio'
  if (post.hashtags.length > 0) return 'hashtag'
  return 'format'
}

// ─── Legacy aggregation helpers (used by webhook ingest route) ────────────────

function safeNum(val: unknown, fallback = 0): number {
  const n = Number(val)
  return isFinite(n) ? n : fallback
}

export function aggregateHashtagTrends(items: Record<string, unknown>[]): NormalisedTrend[] {
  type Entry = { name: string; videoCount: number; totalViews: number; totalLikes: number; bestUrl: string; bestViews: number; bestCaption: string }
  const map = new Map<string, Entry>()

  for (const item of items) {
    const views = safeNum(item.playCount)
    // Skip low-reach posts — only viral-scale content signals a real trend
    if (views < MIN_POST_VIEWS) continue

    const hashtags = (item.hashtags as Array<{ name?: string }> | undefined) || []
    const likes = safeNum(item.diggCount)
    const videoId = item.id as string
    const authorName = (item.authorMeta as Record<string, string>)?.name || 'unknown'
    const videoUrl = (item.webVideoUrl as string) || (videoId ? `https://www.tiktok.com/@${authorName}/video/${videoId}` : '')
    const caption = ((item.text as string) || '').slice(0, 200)

    for (const tag of hashtags) {
      const name = tag.name?.toLowerCase().trim()
      if (!name || name.length < 2) continue
      const existing = map.get(name)
      if (existing) {
        existing.videoCount++; existing.totalViews += views; existing.totalLikes += likes
        if (views > existing.bestViews) { existing.bestViews = views; existing.bestUrl = videoUrl; existing.bestCaption = caption }
      } else {
        map.set(name, { name, videoCount: 1, totalViews: views, totalLikes: likes, bestUrl: videoUrl, bestViews: views, bestCaption: caption })
      }
    }
  }

  const trends: NormalisedTrend[] = []
  for (const entry of Array.from(map.values())) {
    // Require 3+ high-reach posts before calling it a trend
    if (entry.videoCount < 3) continue
    const engScore = entry.totalViews + entry.totalLikes * 5
    trends.push({
      platform: 'tiktok', trend_name: `#${entry.name}`, trend_type: 'hashtag',
      emotional_hook: entry.bestCaption || `#${entry.name} trending on TikTok`,
      engagement_volume: engScore,
      spike_pct: Math.min(Math.round(entry.videoCount * 25 + engScore / 10000), 999),
      source_url: entry.bestUrl, raw_data: { videoCount: entry.videoCount, totalViews: entry.totalViews },
    })
  }
  return trends.sort((a, b) => b.engagement_volume - a.engagement_volume).slice(0, 8)
}

export function aggregateAudioTrends(items: Record<string, unknown>[]): NormalisedTrend[] {
  type AudioEntry = { name: string; author: string; count: number; totalViews: number; bestVideoUrl: string; bestVideoViews: number }
  const musicMap = new Map<string, AudioEntry>()

  for (const item of items) {
    if (safeNum(item.playCount) < MIN_POST_VIEWS) continue
    const music = (item.musicMeta as Record<string, unknown>) || (item.music as Record<string, unknown>)
    if (!music) continue
    const musicId = (music.musicId as string) || (music.id as string)
    if (!musicId) continue
    const musicName = (music.musicName as string) || (music.title as string) || ''
    const musicAuthor = (music.musicAuthor as string) || (music.authorName as string) || ''
    if (!musicName) continue

    const views = safeNum(item.playCount)
    const videoId = item.id as string
    const authorName = (item.authorMeta as Record<string, string>)?.name || 'unknown'
    const videoUrl = (item.webVideoUrl as string) || (videoId ? `https://www.tiktok.com/@${authorName}/video/${videoId}` : '')

    const existing = musicMap.get(musicId)
    if (existing) {
      existing.count++; existing.totalViews += views
      if (views > existing.bestVideoViews) { existing.bestVideoViews = views; existing.bestVideoUrl = videoUrl }
    } else {
      musicMap.set(musicId, { name: musicName, author: musicAuthor, count: 1, totalViews: views, bestVideoUrl: videoUrl, bestVideoViews: views })
    }
  }

  const trends: NormalisedTrend[] = []
  for (const audio of Array.from(musicMap.values())) {
    if (audio.count < 3) continue
    const label = audio.author ? `"${audio.name}" by ${audio.author}` : `"${audio.name}"`
    trends.push({
      platform: 'tiktok', trend_name: label, trend_type: 'audio',
      emotional_hook: `Trending audio used in ${audio.count} videos — ${audio.totalViews.toLocaleString()} total views`,
      engagement_volume: audio.totalViews, spike_pct: Math.min(audio.count * 15, 500),
      source_url: audio.bestVideoUrl, raw_data: { musicName: audio.name, musicAuthor: audio.author, videoCount: audio.count },
    })
  }
  return trends.sort((a, b) => b.spike_pct - a.spike_pct).slice(0, 4)
}

export function aggregateInstagramHashtagTrends(items: Record<string, unknown>[]): NormalisedTrend[] {
  type Entry = { name: string; postCount: number; totalEngagement: number; bestUrl: string; bestEngagement: number; bestCaption: string }
  const map = new Map<string, Entry>()

  for (const item of items) {
    const likes = safeNum(item.likesCount)
    const comments = safeNum(item.commentsCount)
    const views = safeNum(item.videoViewCount)
    const engagement = likes + comments * 3 + views
    if (engagement < MIN_IG_POST_ENGAGEMENT) continue
    const shortCode = item.shortCode as string
    const postUrl = (item.url as string) || (shortCode ? `https://www.instagram.com/p/${shortCode}/` : '')
    const caption = ((item.caption as string) || '').slice(0, 200)
    const rawTags = (item.hashtags as unknown[]) || []
    const tags = rawTags.map(t => typeof t === 'string' ? t.toLowerCase().replace('#', '') : String(t).toLowerCase()).filter(t => t.length > 1)

    for (const name of tags) {
      const existing = map.get(name)
      if (existing) {
        existing.postCount++; existing.totalEngagement += engagement
        if (engagement > existing.bestEngagement) { existing.bestEngagement = engagement; existing.bestUrl = postUrl; existing.bestCaption = caption }
      } else {
        map.set(name, { name, postCount: 1, totalEngagement: engagement, bestUrl: postUrl, bestEngagement: engagement, bestCaption: caption })
      }
    }
  }

  const trends: NormalisedTrend[] = []
  for (const entry of Array.from(map.values())) {
    if (entry.postCount < 3) continue
    trends.push({
      platform: 'instagram', trend_name: `#${entry.name}`, trend_type: 'hashtag',
      emotional_hook: entry.bestCaption || `#${entry.name} trending on Instagram`,
      engagement_volume: entry.totalEngagement, spike_pct: Math.min(Math.round(entry.totalEngagement / 500), 999),
      source_url: entry.bestUrl, raw_data: { postCount: entry.postCount, totalEngagement: entry.totalEngagement },
    })
  }
  return trends.sort((a, b) => b.engagement_volume - a.engagement_volume).slice(0, 8)
}

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
    const sourceUrl = (item.webVideoUrl as string) || (videoId ? `https://www.tiktok.com/@${authorName}/video/${videoId}` : '')
    return {
      platform: 'tiktok', trend_name, trend_type: item.musicMeta ? 'audio' : 'hashtag',
      emotional_hook: ((item.text as string) || '').slice(0, 120) || 'Trending on TikTok',
      engagement_volume: views + likes, spike_pct: safeNum(typeof item.growthRate === 'number' ? (item.growthRate as number) * 100 : 0),
      source_url: sourceUrl, raw_data: {},
    }
  } catch { return null }
}

export function normaliseInstagramItem(item: Record<string, unknown>): NormalisedTrend | null {
  try {
    const rawTags = (item.hashtags as unknown[]) || []
    const firstTag = rawTags[0]
    const trend_name = firstTag ? `#${String(firstTag).toLowerCase().replace('#', '')}` : ((item.ownerUsername as string) || '')
    if (!trend_name) return null
    const likes = safeNum(item.likesCount)
    const comments = safeNum(item.commentsCount)
    const views = safeNum(item.videoViewCount)
    const shortCode = item.shortCode as string
    const sourceUrl = (item.url as string) || (shortCode ? `https://www.instagram.com/p/${shortCode}/` : '')
    return {
      platform: 'instagram', trend_name, trend_type: item.isVideo ? 'format' : 'hashtag',
      emotional_hook: ((item.caption as string) || '').slice(0, 120) || 'Trending on Instagram',
      engagement_volume: likes + comments + views, spike_pct: 0, source_url: sourceUrl, raw_data: {},
    }
  } catch { return null }
}
