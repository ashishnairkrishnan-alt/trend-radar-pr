import { NextResponse } from 'next/server'

const APIFY_BASE = 'https://api.apify.com/v2'

async function startActor(apiKey: string, actorId: string, input: Record<string, unknown>) {
  const res = await fetch(
    `${APIFY_BASE}/acts/${encodeURIComponent(actorId)}/runs?token=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    }
  )
  const body = await res.text()
  if (!res.ok) throw new Error(`${actorId} failed (${res.status}): ${body}`)
  const json = JSON.parse(body)
  return { actorId, runId: json.data.id, status: json.data.status }
}

export async function GET() {
  const apiKey = process.env.APIFY_API_KEY
  if (!apiKey) {
    return NextResponse.json({ success: false, error: 'APIFY_API_KEY not set' }, { status: 500 })
  }

  const keywords = [
    'cocktails','mixology','bartender','nightlife','dubai','abudhabi','uae','gcc',
    'dubainightlife','dubaibar','whisky','scotch','vodka','irishwhiskey','premiumspirits',
  ]

  const results = []
  const errors: string[] = []

  try {
    const r = await startActor(apiKey, 'clockworks/tiktok-scraper', {
      hashtags: keywords,
      resultsPerPage: 10,
      shouldDownloadVideos: false,
      shouldDownloadCovers: false,
      shouldDownloadSubtitles: false,
      shouldDownloadSlideshowImages: false,
    })
    results.push(r)
  } catch (err) {
    errors.push(`TikTok: ${String(err)}`)
  }

  try {
    const r = await startActor(apiKey, 'apify/instagram-hashtag-scraper', {
      hashtags: keywords,
      resultsLimit: 10,
      scrapeType: 'posts',
    })
    results.push(r)
  } catch (err) {
    errors.push(`Instagram: ${String(err)}`)
  }

  return NextResponse.json({
    success: errors.length === 0,
    message: `Started ${results.length} actor runs`,
    runs: results,
    errors: errors.length ? errors : undefined,
  })
}
