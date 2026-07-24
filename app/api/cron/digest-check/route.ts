import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { sendAlertEmail } from '@/lib/email'
export const dynamic = 'force-dynamic'

// Watchdog — runs Monday ~08:30 Dubai (04:30 UTC), 30 min after the digest cron.
// If no successful digest was logged today, it emails an alert to ALERT_RECIPIENT
// so a failed/missed send is caught well before 9am.

export async function GET() {
  const supabase = createServerClient()
  const now = new Date()

  // Start of today (UTC) — the digest cron runs earlier the same day
  const startOfTodayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString()

  // Was there a successful digest send logged today?
  const { data: sentRows, error } = await supabase
    .from('digest_log')
    .select('id, status, sent_at, recipient_count, trend_count')
    .eq('status', 'sent')
    .gte('sent_at', startOfTodayUTC)
    .limit(1)

  if (error) {
    // Can't read the log — alert so it gets checked manually
    const alert = await sendAlertEmail(
      'Trend Radar digest could not be verified',
      `The watchdog could not read the digest log (${error.message}). Please verify manually whether the Monday digest went out.`
    )
    return NextResponse.json({ ok: false, checked: false, alerted: alert.success, error: error.message })
  }

  if (sentRows && sentRows.length > 0) {
    // Success — a digest went out today, no alert needed
    return NextResponse.json({ ok: true, alerted: false, sentToday: sentRows[0] })
  }

  // No successful digest today — send the alert
  const alert = await sendAlertEmail(
    'Monday digest did NOT go out',
    'No successful Trend Radar digest was logged today. It may have failed, found no trends, or the cron did not run. Open the dashboard, confirm trends are present, then go to Settings → Send to All Recipients to send it manually.'
  )

  return NextResponse.json({ ok: false, alerted: alert.success, alertError: alert.error })
}
