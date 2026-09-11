import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { sendDigestEmail } from '@/lib/email'
import { DIGEST_RECIPIENTS, TEST_RECIPIENT, APP_CONFIG } from '@/lib/config'
import { dedupeTrends, trendSignature } from '@/lib/dedupe'
import type { ScoredTrend } from '@/types'

export const dynamic = 'force-dynamic'

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

export async function POST(request: NextRequest) {
  // ?test=1 — send only to the test address (preview without emailing the team)
  const isTest = request.nextUrl.searchParams.get('test') === '1'
  const recipients = isTest ? [TEST_RECIPIENT] : DIGEST_RECIPIENTS
  console.log(`[digest] Starting digest generation${isTest ? ' (TEST mode)' : ''}`)

  const supabase = createServerClient(true)
  const now = new Date()
  const weekNumber = getWeekNumber(now)
  const year = now.getFullYear()
  let usedWeek = weekNumber
  let usedYear = year

  console.log(`[digest] Fetching top ${APP_CONFIG.topTrendsPerDigest} trends for week ${weekNumber}/${year}`)

  // Fetch top scored trends for current week, ordered by highest top-brand score
  let { data: trends, error } = await supabase
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

  // Fallback: if the current week is empty (e.g. the source posted nothing new this
  // week), send the most recent batch that exists instead of erroring out.
  if (!trends || trends.length === 0) {
    console.warn('[digest] Current week empty — falling back to most recent batch')
    const { data: latest } = await supabase
      .from('scored_trends')
      .select('*')
      .order('year', { ascending: false })
      .order('week_number', { ascending: false })
      .order('chivas_score', { ascending: false })
      .limit(120)
    if (latest && latest.length > 0) {
      usedYear = latest[0].year as number
      usedWeek = latest[0].week_number as number
      trends = latest.filter((r) => r.year === usedYear && r.week_number === usedWeek)
    }
  }

  if (!trends || trends.length === 0) {
    console.warn('[digest] No scored trends found at all')
    return NextResponse.json({ error: 'No trends found' }, { status: 404 })
  }

  // Featured/manual trends (spike_pct >= 100) pin to the top, then everything
  // else by the score of its top_brand, descending.
  const sorted = (trends as ScoredTrend[]).sort((a, b) => {
    const getTopScore = (t: ScoredTrend) => {
      const scores = [t.chivas_score, t.absolut_score, t.jameson_score, t.glenlivet_score]
      return Math.max(...scores)
    }
    const featured = (t: ScoredTrend) => ((t.spike_pct || 0) >= 100 ? 1 : 0)
    return featured(b) - featured(a) || getTopScore(b) - getTopScore(a)
  })

  // Collapse repeats before picking the top N, so the email doesn't show the same idea twice
  const top = dedupeTrends(sorted).slice(0, APP_CONFIG.topTrendsPerDigest)

  // Tag NEW vs seen-before by comparing to earlier weeks
  const { data: prior } = await supabase
    .from('scored_trends')
    .select('trend_name')
    .or(`year.lt.${usedYear},and(year.eq.${usedYear},week_number.lt.${usedWeek})`)
  const priorSigs = new Set((prior || []).map((p) => trendSignature(p.trend_name as string)))
  for (const t of top) t.isNew = !priorSigs.has(trendSignature(t.trend_name))
  console.log(`[digest] Selected ${top.length} trends for digest`)

  // Log a pending digest entry (skip logging for test sends to keep history clean)
  let logEntry: { id: string } | null = null
  if (!isTest) {
    const { data, error: logError } = await supabase
      .from('digest_log')
      .insert({
        recipient_count: recipients.length,
        trend_count: top.length,
        status: 'pending',
      })
      .select()
      .single()
    if (logError) console.error('[digest] Failed to create digest log entry:', logError)
    else logEntry = data
  }

  // Send the email
  const result = await sendDigestEmail(top, usedWeek, usedYear, isTest ? recipients : undefined)

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

  console.log(`[digest] Digest sent successfully. Recipients: ${recipients.length}, Trends: ${top.length}${isTest ? ' (TEST)' : ''}`)

  return NextResponse.json({
    success: true,
    test: isTest,
    week: usedWeek,
    year: usedYear,
    trendCount: top.length,
    recipientCount: recipients.length,
  })
}

// GET for dashboard "Send Digest" / "Send Test" buttons
export async function GET(request: NextRequest) {
  return POST(request)
}
