'use client'

import { buildDigestHtml } from '@/lib/emailTemplate'
import type { ScoredTrend } from '@/types'

interface DigestPreviewProps {
  trends: ScoredTrend[]
  weekNumber: number
  year: number
}

export default function DigestPreview({ trends, weekNumber, year }: DigestPreviewProps) {
  const html = buildDigestHtml(trends, weekNumber, year)

  return (
    <div className="border border-pr-muted/20 rounded-lg overflow-hidden">
      <iframe
        srcDoc={html}
        className="w-full"
        style={{ height: '600px', border: 'none' }}
        title={`Digest Week ${weekNumber} ${year}`}
        sandbox="allow-same-origin"
      />
    </div>
  )
}
