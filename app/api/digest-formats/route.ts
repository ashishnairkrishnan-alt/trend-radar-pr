import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { sendToRecipients } from '@/lib/email'
import { buildFormatDigestHtml } from '@/lib/formatEmailTemplate'
import { getWeekNumber, rowToTrend } from '@/lib/formatStore'
import { DIGEST_RECIPIENTS, TEST_RECIPIENT, APP_CONFIG } from '@/lib/config'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

// Email B — Static & Carousel digest. Reads THIS WEEK's stored trends and emails
// them. ?test=1 sends only to the test address. Never sends on its own; only a
// real request (Monday cron or a deliberate button) triggers it.
async function send(request: NextRequest) {
  const isTest = request.nextUrl.searchParams.get('test') === '1'
  const recipients = isTest ? [TEST_RECIPIENT] : DIGEST_RECIPIENTS

  const supabase = createServerClient()
  const now = new Date()
  const week = getWeekNumber(now)
  const year = now.getFullYear()

  const { data, error } = await supabase
    .from('format_trends')
    .select('*')
    .eq('week_number', week)
    .eq('year', year)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 })
  const trends = (data || []).map(rowToTrend)
  if (trends.length === 0) {
    return NextResponse.json({ success: false, error: 'No static/carousel trends stored for this week - run format-generate first.' }, { status: 404 })
  }

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
