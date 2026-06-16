import { NextResponse } from 'next/server'

export async function GET() {
  console.log('[cron/digest] Triggering weekly digest')

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const response = await fetch(`${appUrl}/api/digest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('[cron/digest] Digest API returned error:', data)
      return NextResponse.json(
        { success: false, error: data },
        { status: response.status }
      )
    }

    console.log('[cron/digest] Digest sent successfully:', data)
    return NextResponse.json({ success: true, ...data })
  } catch (err) {
    console.error('[cron/digest] Failed to call digest endpoint:', err)
    return NextResponse.json(
      { success: false, error: String(err) },
      { status: 500 }
    )
  }
}
