import { NextRequest, NextResponse } from 'next/server'
import { fetchDatasetItems } from '@/lib/apify'

const APIFY_BASE = 'https://api.apify.com/v2'

async function getRunInfo(runId: string) {
  const apiKey = process.env.APIFY_API_KEY!
  const res = await fetch(`${APIFY_BASE}/actor-runs/${runId}?token=${apiKey}`)
  if (!res.ok) throw new Error(`Apify run lookup failed: ${res.status}`)
  const json = await res.json()
  return { status: json.data.status as string, datasetId: json.data.defaultDatasetId as string }
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const runId = searchParams.get('runId')
  if (!runId) return NextResponse.json({ error: 'Pass ?runId=...' }, { status: 400 })

  try {
    const { status, datasetId } = await getRunInfo(runId)
    const items = await fetchDatasetItems(datasetId) as Record<string, unknown>[]
    const sample = items.slice(0, 2)

    return NextResponse.json({
      status,
      datasetId,
      totalItems: items.length,
      // Show all keys from first item so we know the field structure
      firstItemKeys: items[0] ? Object.keys(items[0]) : [],
      sample,
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
