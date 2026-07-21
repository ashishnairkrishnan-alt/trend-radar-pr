import { NextRequest, NextResponse } from 'next/server'

// Topic watch — checks whether a specific topic (e.g. mahjong) is actually
// trending on Instagram right now, rather than waiting for it to appear in the
// weekly pipeline. Read-only: nothing is written to the database.
export const maxDuration = 300

const TOPICS: Record<string, { label: string; hashtags: string[] }> = {
  mahjong: { label: 'Mahjong', hashtags: ['mahjong', 'mahjongnight', 'mahjongtiles'] },
}

// A topic counts as "trending" only if there is a real cluster of recent,
// reasonably-engaged posts — not one or two stray uploads.
const MIN_POSTS = 3
const MIN_LIKES = 400

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
    const posts = items
      .filter((i) => i.url)
      .map((i) => ({
        url: i.url as string,
        image: (i.displayUrl as string) || '',
        caption: ((i.caption as string) || '').replace(/\s+/g, ' ').slice(0, 150),
        likes: Number(i.likesCount) || 0,
        comments: Number(i.commentsCount) || 0,
        owner: (i.ownerUsername as string) || '',
        type: (i.type as string) || '',
      }))
      .sort((a, b) => b.likes - a.likes)

    const strong = posts.filter((p) => p.likes >= MIN_LIKES)
    const isTrending = strong.length >= MIN_POSTS

    return NextResponse.json({
      success: true,
      topic: topic.label,
      isTrending,
      checkedAt: new Date().toISOString(),
      totalFound: posts.length,
      strongCount: strong.length,
      threshold: { minPosts: MIN_POSTS, minLikes: MIN_LIKES },
      posts: posts.slice(0, 12),
    })
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
