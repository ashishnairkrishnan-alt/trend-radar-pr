export type Platform = 'instagram' | 'tiktok'
export type TrendType = 'audio' | 'format' | 'hashtag'

export interface RawTrend {
  id: string
  platform: Platform
  trend_name: string
  trend_type: TrendType
  emotional_hook: string
  engagement_volume: number
  spike_pct: number
  raw_data: Record<string, unknown>
  processed: boolean
  created_at: string
}

export interface ScoredTrend {
  id: string
  raw_trend_id: string
  trend_name: string
  platform: Platform
  trend_type: TrendType
  emotional_hook: string
  spike_pct: number
  chivas_score: number
  absolut_score: number
  jameson_score: number
  beefeater_score: number
  top_brand: string
  opportunity_note: string
  content_angle: string
  week_number: number
  year: number
  created_at: string
}

export interface DigestLog {
  id: string
  sent_at: string
  recipient_count: number
  trend_count: number
  status: 'sent' | 'failed' | 'pending'
}

export interface ClaudeScoreResult {
  chivas_score: number
  absolut_score: number
  jameson_score: number
  beefeater_score: number
  top_brand: string
  opportunity_note: string
  content_angle: string
}

export type BrandKey = 'chivas' | 'absolut' | 'jameson' | 'beefeater'

export interface Brand {
  key: BrandKey
  name: string
  color: string
  scoreField: keyof Pick<ScoredTrend, 'chivas_score' | 'absolut_score' | 'jameson_score' | 'beefeater_score'>
}

export interface ApifyWebhookPayload {
  eventType: string
  eventData: {
    actorId: string
    actorRunId: string
  }
  resource: {
    id: string
    actId: string
    status: string
    defaultDatasetId: string
  }
}
