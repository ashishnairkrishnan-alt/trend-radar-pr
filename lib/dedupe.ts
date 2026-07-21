import type { ScoredTrend } from '@/types'

// Trends can arrive from more than one source (Later, TikTok, Apify) and the same
// idea often appears under slightly different wording or a different source_url,
// which surfaced as repetitive cards on the dashboard and in the digest.
// Collapse them by a normalised trend name, keeping the first occurrence
// (callers pass the list already ordered by whatever "best" means to them).

function normaliseName(name: string): string {
  return (name || '')
    .toLowerCase()
    .replace(/["'’“”]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function dedupeTrends(trends: ScoredTrend[]): ScoredTrend[] {
  const seenNames = new Set<string>()
  const seenUrls = new Set<string>()
  const out: ScoredTrend[] = []

  for (const t of trends) {
    const key = normaliseName(t.trend_name)
    if (!key) continue
    if (seenNames.has(key)) continue
    if (t.source_url) {
      if (seenUrls.has(t.source_url)) continue
      seenUrls.add(t.source_url)
    }
    seenNames.add(key)
    out.push(t)
  }

  return out
}
