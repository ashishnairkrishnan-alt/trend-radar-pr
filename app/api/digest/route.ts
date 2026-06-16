import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { sendDigestEmail } from '@/lib/email'
import { DIGEST_RECIPIENTS, APP_CONFIG } from '@/lib/config'
import type { ScoredTrend } from '@/types'

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

export async function POST() {
  console.log('[digest] Starting digest generation')

  const supabase = createServerClient()
  const now = new Date()
  const weekNumber = getWeekNumber(now)
  const year = now.getFullYear()

  console.log(`[digest] Fetching top ${APP_CONFIG.topTrendsPerDigest} trends for week ${weekNumber}/${year}`)

  // Fetch top scored trends for current week, ordered by highest top-brand score
  const { data: trends, error } = await supabase
    .from('scored_trends')
    .select('*')
    .eq('week_number', weekNumber)
    .eq('year', year)
    .order('chivas_score', { ascending: false }) // sort by max; we'll re-sort below
    .limit(50) // fetch more, then pick top 10 by best score

  if (error) {
    console.error('[digest] Failed to fetch trends:', error)
    return NextResponse.json({ error: 'Failed to fetch trends' }, { status: 500 })
  }

  if (!trends || trends.length === 0) {
    console.warn('[digest] No scored trends found for current week')
    return NextResponse.json({ error: 'No trends found for current week' }, { status: 404 })
  }

  // Sort by the score of the top_brand for that trend, descending
  const sorted = (trends as ScoredTrend[]).sort((a, b) => {
    const getTopScore = (t: ScoredTrend) => {
      const scores = [t.chivas_score, t.absolut_score, t.jameson_score, t.glenlivet_score]
      return Math.max(...scores)
    }
    return getTopScore(b) - getTopScore(a)
  })

  const top = sorted.slice(0, APP_CONFIG.topTrendsPerDigest)
  console.log(`[digest] Selected ${top.length} trends for digest`)

  // Log a pending digest entry
  const { data: logEntry, error: logError } = await supabase
    .from('digest_log')
    .insert({
      recipient_count: DIGEST_RECIPIENTS.length,
      trend_count: top.length,
      status: 'pending',
    })
    .select()
    .single()

  if (logError) {
    console.error('[digest] Failed to create digest log entry:', logError)
  }

  // Send the email
  const result = await sendDigestEmail(top, weekNumber, year)

  // Update log entry status
  if (logEntry) {
    await supabase
      .from('digest_log')
      .update({ status: result.success ? 'sent' : 'failed' })
      .eq('id', logEntry.id)
  }

  if (!result.success) {
    console.error('[digest] Email send failed:', result.error)
    return NextResponse.json(
      { error: 'Email send failed', detail: result.error },
      { status: 500 }
    )
  }

  console.log(`[digest] Digest sent successfully. Recipients: ${DIGEST_RECIPIENTS.length}, Trends: ${top.length}`)

  return NextResponse.json({
    success: true,
    week: weekNumber,
    year,
    trendCount: top.length,
    recipientCount: DIGEST_RECIPIENTS.length,
  })
}

// GET for dashboard "Send Digest" button
export async function GET() {
  return POST()
}
