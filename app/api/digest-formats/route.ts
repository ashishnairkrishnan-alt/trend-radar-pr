import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { sendToRecipients } from '@/lib/email'
import { buildFormatDigestHtml } from '@/lib/formatEmailTemplate'
import { rowToTrend } from '@/lib/formatStore'
import { trendSignature } from '@/lib/dedupe'
import { DIGEST_RECIPIENTS, TEST_RECIPIENT, APP_CONFIG } from '@/lib/config'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Email B — Static & Carousel digest. Emails the MOST RECENT stored batch (the
// Monday cron regenerates it that morning). ?test=1 sends only to the test
// address. Never sends on its own; only a real request (cron or button) triggers it.
async function send(request: NextRequest) {
  const isTest = request.nextUrl.searchParams.get('test') === '1'
  const recipients = isTest ? [TEST_RECIPIENT] : DIGEST_RECIPIENTS

  const supabase = createServerClient()
  const { data, error } = await supabase
    .from('format_trends')
    .select('*')
    .order('year', { ascending: false })
    .order('week_number', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(300)

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  const all = data || []
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
