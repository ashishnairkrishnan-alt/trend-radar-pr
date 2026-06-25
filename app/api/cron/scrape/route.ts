import { NextResponse } from 'next/server'
import { triggerAllScrapers } from '@/lib/apify'

export async function GET() {
  console.log('[cron/scrape] Starting TikTok trending feed scrape')

  if (!process.env.APIFY_API_KEY) {
    return NextResponse.json({ success: false, error: 'APIFY_API_KEY not set' }, { status: 500 })
  }

  try {
    const runs = await triggerAllScrapers()
    console.log(`[cron/scrape] Started ${runs.length} actor run(s)`)
    return NextResponse.json({
      success: true,
      message: `Started ${runs.length} actor run(s)`,
      runs,
    })
  } catch (err) {
    console.error('[cron/scrape] Failed:', err)
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
