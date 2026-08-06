import type { ScoredTrend } from '@/types'

// Trends arrive from multiple sources and often describe the same idea with
// slightly different wording ("Summer schedule" vs "The summer schedule"), which
// surfaced as repetitive cards/emails. We collapse them by a "signature" — the
// meaningful words only, order-independent — so reworded duplicates merge too.

// Filler words that don't distinguish one trend from another.
const FILLER = new Set([
  'the', 'a', 'an', 'and', 'or', 'of', 'to', 'for', 'in', 'on', 'with', 'your',
  'you', 'my', 'me', 'i', 'is', 'it', 'that', 'this', 'how', 'when', 'what',
  'trend', 'trending', 'post', 'posts', 'reel', 'reels', 'carousel', 'carousels',
  'static', 'video', 'viral', 'moment', 'moments', 'format', 'challenge', 'pov',
  'new', 'best',
])

// Order-independent signature of the significant words in a trend name.
export function trendSignature(name: string): string {
  const tokens = (name || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 1 && !FILLER.has(t))
  // De-dupe + sort so word order and repeats don't matter
  return Array.from(new Set(tokens)).sort().join(' ')
}

// Generic: keep the first item for each signature. Empty signatures fall back to
// the raw lowercased name so nothing is silently dropped.
export function dedupeByName<T>(items: T[], getName: (item: T) => string): T[] {
  const seen = new Set<string>()
  const out: T[] = []
  for (const item of items) {
    const name = getName(item)
    const key = trendSignature(name) || name.toLowerCase().trim()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(item)
  }
  return out
}

// Reels: signature dedup, plus drop any exact source_url repeat.
export function dedupeTrends(trends: ScoredTrend[]): ScoredTrend[] {
  const seenUrls = new Set<string>()
  const bySig = dedupeByName(trends, (t) => t.trend_name)
  const out: ScoredTrend[] = []
  for (const t of bySig) {
    if (t.source_url) {
      if (seenUrls.has(t.source_url)) continue
      seenUrls.add(t.source_url)
    }
    out.push(t)
  }
  return out
}
