import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import type { DigestLog } from '@/types'

// Server-side read for the digest history page — uses the service-role key so it
// is not affected by RLS on the anon key (which returns 0 rows in the browser).

export async function GET() {
  try {
    const supabase = createServerClient()
    const { data, error } = await supabase
      .from('digest_log')
      .select('*')
      .order('sent_at', { ascending: false })
      .limit(20)

    if (error) {
      return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, logs: (data as DigestLog[]) || [] })
  } catch (err) {
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 })
  }
}
