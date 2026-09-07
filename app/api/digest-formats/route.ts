import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { sendToRecipients } from '@/lib/email'
import { buildFormatDigestHtml } from '@/lib/formatEmailTemplate'
import { rowToTrend, trendToRow, getWeekNumber } from '@/lib/formatStore'
import { generateFormatTrends } from '@/lib/formatTrends'
import { trendSignature } from '@/lib/dedupe'
import { DIGEST_RECIPIENTS, TEST_RECIPIENT, APP_CONFIG } from '@/lib/config'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Email B — Static & Carousel digest. Emails the MOST RECENT stored batch (the
// Monday cron regenerates it that morning). ?test=1 sends only to the test
// address. Never sends on its own; only a real request (cron or button) triggers it.
async function send(request: NextRequest) {
  const isTest = request.nextUrl.searchParams.get('test') === '1'
  const recipients = isTest ? [TEST_RECIPIENT] : DIGEST_RECIPIENTS

  const supabase = createServerClient(true)
  const now = new Date()
  const curWeek = getWeekNumber(now)
  const curYear = now.getFullYear()

  const readLatest = async () => {
    const { data, error } = await supabase
      .from('format_trends')
      .select('*')
      .order('year', { ascending: false })
      .order('week_number', { ascending: false })
      .order('created_at', { ascending: true })
      .limit(300)
    return { rows: data || [], error }
  }

  let { rows: all, error } = await readLatest()
  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })

  // Freshness guard: if the newest stored batch isn't the current week, the
  // Monday format-generate likely failed or didn't run. Regenerate now so we
  // never email a stale batch. If regeneration fails, fall through and send the
  // most recent batch we have (better stale than no email).
  const latest = all[0]
  const isStale = !latest || latest.week_number !== curWeek || latest.year !== curYear
  if (isStale) {
    try {
      const fresh = await generateFormatTrends()
      if (fresh.length > 0) {
        await supabase.from('format_trends').delete().eq('week_number', curWeek).eq('year', curYear)
        await supabase.from('format_trends').insert(fresh.map((t) => trendToRow(t, curWeek, curYear)))
        const reread = await readLatest()
        if (!reread.error && reread.rows.length > 0) all = reread.rows
      }
    } catch (e) {
      console.error('[digest-formats] regenerate-on-stale failed:', e)
    }
  }

  if (all.length === 0) {
    return NextResponse.json({ success: false, error: 'No static/carousel trends stored yet - run format-generate first.' }, { status: 404 })
  }
  const week = all[0].week_number
  const year = all[0].year
  const trends = all.filter((r) => r.year === year && r.week_number === week).map(rowToTrend)

  // Tag NEW vs seen-before against earlier stored batches
  const priorSigs = new Set(
    all.filter((r) => !(r.year === year && r.week_number === week))
      .map((r) => trendSignature(String(r.trend_name || '')))
  )
  for (const t of trends) t.isNew = !priorSigs.has(trendSignature(t.trend_name))

  const html = buildFormatDigestHtml(trends, week, year)
  const subject = `${isTest ? '[TEST] ' : ''}Trend Radar — Static & Carousel · Week ${week} ${APP_CONFIG.fiscalYear} | ${trends.length} trends`
  const result = await sendToRecipients(subject, html, recipients)

  if (!result.success) {
    return NextResponse.json({ success: false, error: result.error }, { status: 500 })
  }
  return NextResponse.json({ success: true, test: isTest, week, year, trendCount: trends.length, recipientCount: recipients.length })
}

export async function POST(request: NextRequest) { return send(request) }
export async function GET(request: NextRequest) { return send(request) }
