import { NextResponse } from 'next/server'
import { createServerClient, getBrowserClient } from '@/lib/supabase'

export async function GET() {
  const results: Record<string, unknown> = {}

  // Test 1: Server-side read (service role key)
  try {
    const server = createServerClient()
    const { data, error, count } = await server
      .from('scored_trends')
      .select('id, trend_name, week_number, year', { count: 'exact' })
      .limit(5)
    results.server_read = { ok: !error, count, rows: data, error }
  } catch (e) {
    results.server_read = { ok: false, error: String(e) }
  }

  // Test 2: Check env vars are present
  results.env = {
    supabase_url: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    anon_key: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    service_key: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    anthropic: !!process.env.ANTHROPIC_API_KEY,
  }

  // Test 3: Week number
  const now = new Date()
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  results.current_week = { week, year: now.getFullYear(), utc_now: now.toISOString() }

  return NextResponse.json(results, { status: 200 })
}
