import { APIFY_ACTORS, KEYWORD_CLUSTERS } from './config'

const APIFY_BASE = 'https://api.apify.com/v2'

interface ActorRunResult {
  actorId: string
  runId: string
  status: string
}

function getWebhookUrl(): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
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

  // TikTok scraper
  try {
    const tiktokResult = await runActor(APIFY_ACTORS.tiktokScraper, {
      hashtags: allKeywords,
      resultsPerPage: 50,
      shouldDownloadVideos: false,
      shouldDownloadCovers: false,
      shouldDownloadSubtitles: false,
      shouldDownloadSlideshowImages: false,
    })
    results.push(tiktokResult)
  } catch (err) {
    console.error('[apify] TikTok scraper failed:', err)
  }

  // Instagram hashtag scraper
  try {
    const igHashtagResult = await runActor(APIFY_ACTORS.instagramHashtag, {
      hashtags: allKeywords,
      resultsLimit: 50,
      scrapeType: 'posts',
    })
    results.push(igHashtagResult)
  } catch (err) {
    console.error('[apify] Instagram hashtag scraper failed:', err)
  }

  // Instagram reel scraper
  try {
    const igReelResult = await runActor(APIFY_ACTORS.instagramReel, {
      hashtags: allKeywords.slice(0, 20), // reels scraper has tighter limits
      resultsLimit: 30,
    })
    results.push(igReelResult)
  } catch (err) {
    console.error('[apify] Instagram reel scraper failed:', err)
  }

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
  raw_data: Record<string, unknown>
}

export function normaliseTikTokItem(item: Record<string, unknown>): NormalisedTrend | null {
  try {
    const hashtag = (item.challengeName as string) || (item.title as string) || ''
    if (!hashtag) return null

    const views = (item.stats as Record<string, number>)?.viewCount || 0
    const plays = (item.stats as Record<string, number>)?.playCount || 0
    const engagementVolume = Math.max(views, plays)

    return {
      platform: 'tiktok',
      trend_name: hashtag,
      trend_type: item.music ? 'audio' : 'hashtag',
      emotional_hook: (item.desc as string)?.slice(0, 120) || 'Trending on TikTok',
      engagement_volume: engagementVolume,
      spike_pct: typeof item.growthRate === 'number' ? (item.growthRate as number) * 100 : 0,
      raw_data: item,
    }
  } catch {
    return null
  }
}

export function normaliseInstagramItem(item: Record<string, unknown>): NormalisedTrend | null {
  try {
    const hashtag =
      (item.hashtag as string) ||
      (item.ownerUsername as string) ||
      (item.id as string) ||
      ''
    if (!hashtag) return null

    const likes = (item.likesCount as number) || 0
    const comments = (item.commentsCount as number) || 0
    const views = (item.videoViewCount as number) || 0

    return {
      platform: 'instagram',
      trend_name: hashtag,
      trend_type: item.isVideo ? 'format' : 'hashtag',
      emotional_hook: (item.caption as string)?.slice(0, 120) || 'Trending on Instagram',
      engagement_volume: likes + comments + views,
      spike_pct: 0, // Instagram API doesn't expose growth rates directly
      raw_data: item,
    }
  } catch {
    return null
  }
}
