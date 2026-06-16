import { Resend } from 'resend'
import { DIGEST_RECIPIENTS } from './config'
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

export async function sendDigestEmail(
  trends: ScoredTrend[],
  weekNumber: number,
  year: number
): Promise<{ success: boolean; messageIds?: string[]; error?: string }> {
  if (DIGEST_RECIPIENTS.length === 0) {
    return { success: false, error: 'No recipients configured' }
  }

  const html = buildDigestHtml(trends, weekNumber, year)
  const subject = `Trend Radar — Week ${weekNumber} ${APP_CONFIG.fiscalYear} | ${trends.length} Trends Scored`
  const resend = getResendClient()
  const fromEmail = FROM_EMAIL()

  console.log(`[email] Sending digest to ${DIGEST_RECIPIENTS.length} recipients`)

  try {
    const messageIds: string[] = []

    for (const recipient of DIGEST_RECIPIENTS) {
      const { data, error } = await resend.emails.send({
        from: fromEmail,
        to: recipient,
        subject,
        html,
      })

      if (error) {
        console.error(`[email] Failed to send to ${recipient}:`, error)
      } else {
        messageIds.push(data?.id || '')
        console.log(`[email] Sent to ${recipient}: ${data?.id}`)
      }
    }

    return { success: true, messageIds }
  } catch (err) {
    console.error('[email] Resend error:', err)
    return { success: false, error: String(err) }
  }
}
