import Anthropic from '@anthropic-ai/sdk'
import { createServerClient } from './supabase'
import type { RawTrend, ClaudeScoreResult, ScoredTrend } from '@/types'

function getAnthropicClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY is not set')
  }
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

const SYSTEM_PROMPT = `You are a brand strategist for Pernod Ricard Middle East. You score social media trends for relevance to four spirits brands. You always respond in valid JSON only, no other text.

Brands and their identities:
- Chivas Regal: premium, sophisticated, slow moments, success, gifting, brotherhood
- Absolut Vodka: bold, creative, artistic, expressive, inclusive, party
- Jameson: social, relaxed, approachable, everyone's welcome, Irish warmth
- The Glenlivet: pioneering, single malt scotch, smooth, approachable luxury, nature, discovery

For each trend, evaluate:
1. Can this trend carry a spirits or nightlife narrative?
2. Which brand does the emotional tone match best?
3. What is the best content format angle?

Return JSON in exactly this format:
{
  "chivas_score": number 1-5,
  "absolut_score": number 1-5,
  "jameson_score": number 1-5,
  "glenlivet_score": number 1-5,
  "top_brand": string,
  "opportunity_note": string (max 20 words, what the brand should do),
  "content_angle": string (max 15 words, the specific reel or post format)
}`

function buildUserMessage(trend: RawTrend): string {
  return `Trend: ${trend.trend_name}
Platform: ${trend.platform}
Type: ${trend.trend_type}
Emotional hook: ${trend.emotional_hook}
Engagement spike: ${trend.spike_pct}%
Score this trend for all four brands.`
}

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

async function scoreSingleTrend(trend: RawTrend): Promise<ClaudeScoreResult> {
  console.log(`[scorer] Scoring trend: "${trend.trend_name}" (${trend.platform})`)

  const message = await getAnthropicClient().messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildUserMessage(trend) }],
  })

  const content = message.content[0]
  if (content.type !== 'text') {
    throw new Error(`Unexpected Claude response type: ${content.type}`)
  }

  let parsed: ClaudeScoreResult
  try {
    // Strip markdown code fences if present
    const cleaned = content.text.replace(/```(?:json)?\n?/g, '').trim()
    parsed = JSON.parse(cleaned)
  } catch (err) {
    console.error('[scorer] Failed to parse Claude response:', content.text)
    throw new Error(`Claude returned invalid JSON: ${err}`)
  }

  // Validate scores are 1-5
  const scores: (keyof ClaudeScoreResult)[] = [
    'chivas_score',
    'absolut_score',
    'jameson_score',
    'glenlivet_score',
  ]
  for (const key of scores) {
    const val = parsed[key] as number
    if (typeof val !== 'number' || val < 1 || val > 5) {
      throw new Error(`Invalid score for ${key}: ${val}`)
    }
  }

  console.log(
    `[scorer] Scored "${trend.trend_name}": top_brand=${parsed.top_brand}, scores=[${parsed.chivas_score},${parsed.absolut_score},${parsed.jameson_score},${parsed.glenlivet_score}]`
  )
  return parsed
}

export async function scoreTrendBatch(rawTrends: RawTrend[]): Promise<void> {
  const supabase = createServerClient()
  const now = new Date()
  const weekNumber = getWeekNumber(now)
  const year = now.getFullYear()

  console.log(`[scorer] Processing batch of ${rawTrends.length} trends (week ${weekNumber}/${year})`)

  for (const trend of rawTrends) {
    try {
      const scores = await scoreSingleTrend(trend)

      const scoredRow: Omit<ScoredTrend, 'id' | 'created_at'> = {
        raw_trend_id: trend.id,
        trend_name: trend.trend_name,
        platform: trend.platform,
        trend_type: trend.trend_type,
        emotional_hook: trend.emotional_hook,
        spike_pct: trend.spike_pct,
        source_url: trend.source_url,
        ...scores,
        week_number: weekNumber,
        year,
      }

      const { error: insertError } = await supabase
        .from('scored_trends')
        .insert(scoredRow)

      if (insertError) {
        console.error(`[scorer] Failed to insert scored trend "${trend.trend_name}":`, insertError)
        continue
      }

      // Mark raw trend as processed
      const { error: updateError } = await supabase
        .from('raw_trends')
        .update({ processed: true })
        .eq('id', trend.id)

      if (updateError) {
        console.error(`[scorer] Failed to mark raw trend processed "${trend.id}":`, updateError)
      }

      // Small delay to avoid hitting Claude rate limits
      await new Promise((r) => setTimeout(r, 300))
    } catch (err) {
      console.error(`[scorer] Error processing trend "${trend.trend_name}":`, err)
    }
  }

  console.log(`[scorer] Batch complete`)
}

export async function scoreUnprocessedTrends(): Promise<number> {
  const supabase = createServerClient()

  const { data: unprocessed, error } = await supabase
    .from('raw_trends')
    .select('*')
    .eq('processed', false)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[scorer] Failed to fetch unprocessed trends:', error)
    throw error
  }

  if (!unprocessed || unprocessed.length === 0) {
    console.log('[scorer] No unprocessed trends found')
    return 0
  }

  await scoreTrendBatch(unprocessed as RawTrend[])
  return unprocessed.length
}
