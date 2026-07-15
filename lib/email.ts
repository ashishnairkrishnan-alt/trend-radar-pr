import { Resend } from 'resend'
import { DIGEST_RECIPIENTS, ALERT_RECIPIENT } from './config'
import { buildDigestHtml } from './emailTemplate'
import type { ScoredTrend } from '@/types'
import { APP_CONFIG } from './config'

// Re-export for any server-side consumers that need the full template
export { buildDigestHtml }

// Lazy-initialized so the constructor doesn't throw at build time when env vars aren't present
function getResendClient() {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not set')
  }
  return new Resend(process.env.RESEND_API_KEY)
}

const FROM_EMAIL = () => process.env.RESEND_FROM_EMAIL || 'trend-radar@pernodricard.com'

// Plain failure alert — used by the Monday watchdog when the digest didn't go out.
export async function sendAlertEmail(
  subject: string,
  message: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const resend = getResendClient()
    const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#1A2B4A;line-height:1.6;">
      <h2 style="color:#B00020;margin:0 0 12px;">⚠️ Trend Radar Alert</h2>
      <p style="margin:0 0 12px;">${message}</p>
      <p style="margin:0;color:#8A94A6;font-size:12px;">Sent automatically by the Trend Radar watchdog. Check the dashboard and Resend logs, then use Settings → Send to All Recipients if needed.</p>
    </div>`
    const { error } = await resend.emails.send({
      from: FROM_EMAIL(),
      to: ALERT_RECIPIENT,
      subject: `⚠️ ${subject}`,
      html,
    })
    if (error) return { success: false, error: String(error) }
    return { success: true }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

export async function sendDigestEmail(
  trends: ScoredTrend[],
  weekNumber: number,
  year: number,
  recipientsOverride?: string[]
): Promise<{ success: boolean; messageIds?: string[]; error?: string }> {
  const recipients = recipientsOverride && recipientsOverride.length > 0
    ? recipientsOverride
    : DIGEST_RECIPIENTS
  if (recipients.length === 0) {
    return { success: false, error: 'No recipients configured' }
  }

  const isTest = !!(recipientsOverride && recipientsOverride.length > 0)
  const html = buildDigestHtml(trends, weekNumber, year)
  const subject = `${isTest ? '[TEST] ' : ''}Trend Radar — Week ${weekNumber} ${APP_CONFIG.fiscalYear} | ${trends.length} Trends Scored`
  const resend = getResendClient()
  const fromEmail = FROM_EMAIL()

  console.log(`[email] Sending digest to ${recipients.length} recipients${isTest ? ' (TEST)' : ''}`)

  try {
    const messageIds: string[] = []
    const failed: string[] = []

    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i]

      // Throttle to respect Resend's rate limit (~2 req/s). Without this, the
      // 3rd+ recipients in a tight loop get 429s and silently miss the email.
      if (i > 0) await new Promise((r) => setTimeout(r, 600))

      // Retry once on failure (covers a transient rate-limit hit)
      let sent = false
      for (let attempt = 0; attempt < 2 && !sent; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 800))
        const { data, error } = await resend.emails.send({
          from: fromEmail,
          to: recipient,
          subject,
          html,
        })
        if (error) {
          console.error(`[email] Failed to send to ${recipient} (attempt ${attempt + 1}):`, error)
        } else {
          messageIds.push(data?.id || '')
          console.log(`[email] Sent to ${recipient}: ${data?.id}`)
          sent = true
        }
      }
      if (!sent) failed.push(recipient)
    }

    // Only a true success if every recipient received it
    if (failed.length > 0) {
      return {
        success: false,
        messageIds,
        error: `Failed to send to ${failed.length}/${recipients.length}: ${failed.join(', ')}`,
      }
    }
    return { success: true, messageIds }
  } catch (err) {
    console.error('[email] Resend error:', err)
    return { success: false, error: String(err) }
  }
}
