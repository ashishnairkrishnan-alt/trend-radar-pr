import Anthropic from '@anthropic-ai/sdk'
import { createServerClient } from './supabase'
import type { RawTrend, ClaudeScoreResult, ScoredTrend } from '@/types'
import type { TikTokPost } from './apify'

function getAnthropicClient() {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY is not set')
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

// ─── System Prompt ────────────────────────────────────────────────────────────
// Cultural adjacency scoring — not just "does it mention alcohol" but
// "what world does this trend live in, and which brand owns that world."

export const SCORING_SYSTEM_PROMPT = `You are a brand strategist for Pernod Ricard Middle East. You score social media trends for four spirits brands. You always respond in valid JSON only, no other text.

Brand cultural territories:
- Chivas Regal: luxury achievement, cinematic drama, prestige occasions, Ferrari energy, rooftop moments, gifting, brotherhood, slow success
- Absolut Vodka: bold creativity, art, nightlife, electronic music, self-expression, inclusive parties, urban culture, bold aesthetics
- Jameson: live music, festivals, indie culture, pub warmth, laid-back social energy, everyone welcome, Irish spirit, approachable fun
- The Glenlivet: nature, outdoor discovery, ambient sounds, quiet exploration, single malt craft, unhurried appreciation, Scotland, refinement

Scoring rules:
1. Score 1-5 based on how well the trend's cultural world overlaps with each brand's territory
2. A luxury car trend scores high for Chivas (prestige world), not just drinks content
3. A music festival trend scores high for Jameson (live music world), not just bar content
4. Score 4-5 only if the brand could authentically own this content space
5. top_brand must be one of: "Chivas Regal", "Absolut Vodka", "Jameson", "The Glenlivet"

Return JSON in exactly this format:
{
  "chivas_score": number 1-5,
  "absolut_score": number 1-5,
  "jameson_score": number 1-5,
  "glenlivet_score": number 1-5,
  "top_brand": string,
  "opportunity_note": string (max 20 words — specific action the brand should take),
  "content_angle": string (max 15 words — the exact reel or post format)
}`

// ─── Rich TikTok post scoring (trending feed pipeline) ───────────────────────

export async function scoreTikTokPost(post: TikTokPost): Promise<ClaudeScoreResult> {
  const client = getAnthropicClient()

  const hashtags = post.hashtags.map(h => `#${h.name}`).join(' ')
  const music = post.musicMeta
  const musicLine = music.musicName
    ? `Music: "${music.musicName}"${music.musicAuthor ? ` by ${music.musicAuthor}` : ''} (original track: ${music.musicOriginal ? 'yes' : 'no'})`
    : 'Music: none'

  const textContent = `Caption: ${post.text || '(no caption)'}
Hashtags: ${hashtags || '(none)'}
${musicLine}
Engagement: ${post.stats.playCount.toLocaleString()} views, ${post.stats.diggCount.toLocaleString()} likes, ${post.stats.commentCount.toLocaleString()} comments, ${post.stats.shareCount.toLocaleString()} shares

Score this TikTok post for all four brands based on cultural territory fit.`

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    system: SCORING_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: textContent }],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  const cleaned = text.replace(/```(?:json)?\n?/g, '').trim()
  const parsed = JSON.parse(cleaned) as ClaudeScoreResult

  // Validate scores
  for (const key of ['chivas_score', 'absolut_score', 'jameson_score', 'glenlivet_score'] as const) {
    const val = parsed[key]
    if (typeof val !== 'number' || val < 1 || val > 5) {
      throw new Error(`Invalid score for ${key}: ${val}`)
    }
  }

  return parsed
}

// ─── Legacy batch scorer (used by /api/ingest webhook route) ─────────────────

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
  const message = await getAnthropicClient().messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 300,
    system: SCORING_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildUserMessage(trend) }],
  })

  const content = message.content[0]
  if (content.type !== 'text') throw new Error(`Unexpected Claude response type: ${content.type}`)

  const cleaned = content.text.replace(/```(?:json)?\n?/g, '').trim()
  const parsed = JSON.parse(cleaned) as ClaudeScoreResult

  for (const key of ['chivas_score', 'absolut_score', 'jameson_score', 'glenlivet_score'] as const) {
    const val = parsed[key]
    if (typeof val !== 'number' || val < 1 || val > 5) throw new Error(`Invalid score for ${key}: ${val}`)
  }

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

      const { error } = await supabase.from('scored_trends').upsert(scoredRow, {
        onConflict: 'source_url',
        ignoreDuplicates: true,
      })
      if (error) console.error(`[scorer] Failed to upsert "${trend.trend_name}":`, error)

      await supabase.from('raw_trends').update({ processed: true }).eq('id', trend.id)
      await new Promise(r => setTimeout(r, 300))
    } catch (err) {
      console.error(`[scorer] Error processing trend "${trend.trend_name}":`, err)
    }
  }

  console.log('[scorer] Batch complete')
}

export async function scoreUnprocessedTrends(): Promise<number> {
  const supabase = createServerClient()
  const { data: unprocessed, error } = await supabase
    .from('raw_trends').select('*').eq('processed', false).order('created_at', { ascending: true })

  if (error) throw error
  if (!unprocessed || unprocessed.length === 0) return 0

  await scoreTrendBatch(unprocessed as RawTrend[])
  return unprocessed.length
}
