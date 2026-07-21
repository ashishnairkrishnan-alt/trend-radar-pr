import { NextRequest, NextResponse } from 'next/server'

// Topic watch — checks whether a specific topic (e.g. mahjong) is actually
// trending on Instagram right now, rather than waiting for it to appear in the
// weekly pipeline. Read-only: nothing is written to the database.
export const maxDuration = 300

const TOPICS: Record<string, { label: string; hashtags: string[] }> = {
  mahjong: {
    label: 'Mahjong',
    // Region-specific tags first, then general ones (filtered to the region below)
    hashtags: ['mahjongdubai', 'dubaimahjong', 'mahjonguae', 'mahjongnightdubai', 'mahjong', 'mahjongnight'],
  },
}

// Keep only posts that are actually tied to our market
const REGION_LABEL = 'Dubai / UAE'
const REGION_RE = /\b(dubai|dxb|u\.?a\.?e|abu ?dhabi|emirates|sharjah|ajman|middle ?east|mena|gcc)\b/i

// A topic counts as "trending" only if there is a real cluster of recent,
// reasonably-engaged posts — not one or two stray uploads. Thresholds are lower
// than a worldwide check because a single-market audience is naturally smaller.
const MIN_POSTS = 3
const MIN_LIKES = 150

export async function GET(request: NextRequest) {
  const key = (request.nextUrl.searchParams.get('topic') || 'mahjong').toLowerCase()
  const topic = TOPICS[key]
  if (!topic) return NextResponse.json({ success: false, error: `Unknown topic: ${key}` }, { status: 400 })

  const token = process.env.APIFY_API_KEY
  if (!token) return NextResponse.json({ success: false, error: 'APIFY_API_KEY not set' }, { status: 500 })

  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${token}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          directUrls: topic.hashtags.map((h) => `https://www.instagram.com/explore/tags/${h}/`),
          resultsType: 'posts',
          resultsLimit: 18,
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

    const all = items
      .filter((i) => i.url)
      .map((i) => {
        const caption = ((i.caption as string) || '').replace(/\s+/g, ' ')
        const tags = ((i.hashtags as string[]) || []).join(' ')
        const location = (i.locationName as string) || ''
        return {
          url: i.url as string,
          image: (i.displayUrl as string) || '',
          caption: caption.slice(0, 150),
          likes: Number(i.likesCount) || 0,
          comments: Number(i.commentsCount) || 0,
          owner: (i.ownerUsername as string) || '',
          type: (i.type as string) || '',
          location,
          // Region match on caption, hashtags or the tagged location
          inRegion: REGION_RE.test(`${caption} ${tags} ${location}`),
        }
      })

    const posts = all.filter((p) => p.inRegion).sort((a, b) => b.likes - a.likes)
    const strong = posts.filter((p) => p.likes >= MIN_LIKES)
    const isTrending = strong.length >= MIN_POSTS

    return NextResponse.json({
      success: true,
      topic: topic.label,
      region: REGION_LABEL,
      isTrending,
      checkedAt: new Date().toISOString(),
      totalFound: posts.length,
      worldwideFound: all.length,
      strongCount: strong.length,
      threshold: { minPosts: MIN_POSTS, minLikes: MIN_LIKES },
      posts: posts.slice(0, 12),
    })
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
