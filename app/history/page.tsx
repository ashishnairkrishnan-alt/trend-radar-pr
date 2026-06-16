'use client'

import { useState, useEffect } from 'react'
import { getBrowserClient } from '@/lib/supabase'
import type { DigestLog, ScoredTrend } from '@/types'
import dynamic from 'next/dynamic'

const DigestPreview = dynamic(() => import('@/components/DigestPreview'), { ssr: false })

function getWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    sent: 'bg-brand-jameson/10 text-brand-jameson border-brand-jameson/20',
    failed: 'bg-brand-glenlivet/10 text-brand-glenlivet border-brand-glenlivet/20',
    pending: 'bg-pr-gold/10 text-pr-gold border-pr-gold/20',
  }
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${styles[status] || styles.pending}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  )
}

export default function HistoryPage() {
  const [logs, setLogs] = useState<DigestLog[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedLog, setSelectedLog] = useState<DigestLog | null>(null)
  const [previewTrends, setPreviewTrends] = useState<ScoredTrend[]>([])
  const [loadingPreview, setLoadingPreview] = useState(false)

  useEffect(() => {
    const fetchLogs = async () => {
      const supabase = getBrowserClient()
      const { data, error } = await supabase
        .from('digest_log')
        .select('*')
        .order('sent_at', { ascending: false })
        .limit(20)

      if (error) console.error('[history] Failed to fetch logs:', error)
      else setLogs((data as DigestLog[]) || [])
      setLoading(false)
    }
    fetchLogs()
  }, [])

  const handlePreview = async (log: DigestLog) => {
    setSelectedLog(log)
    setLoadingPreview(true)

    const sentDate = new Date(log.sent_at)
    const weekNumber = getWeekNumber(sentDate)
    const year = sentDate.getFullYear()

    const supabase = getBrowserClient()
    const { data, error } = await supabase
      .from('scored_trends')
      .select('*')
      .eq('week_number', weekNumber)
      .eq('year', year)
      .limit(10)

    if (error) console.error('[history] Failed to fetch preview trends:', error)
    else setPreviewTrends((data as ScoredTrend[]) || [])
    setLoadingPreview(false)
  }

  return (
    <div>
      <div className="mb-6">
        <div className="text-[10px] uppercase tracking-widest text-pr-muted font-medium mb-1">
          Archive
        </div>
        <h1 className="text-2xl font-serif font-bold text-pr-text">Digest History</h1>
        <p className="text-sm text-pr-muted mt-0.5">Past weekly email digests â€” click to preview</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Log list */}
        <div className="lg:col-span-2 space-y-3">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-white rounded-lg shadow-card p-4 animate-pulse h-20" />
            ))
          ) : logs.length === 0 ? (
            <div className="bg-white rounded-lg shadow-card p-8 text-center">
              <p className="text-pr-muted text-sm">No digests sent yet.</p>
            </div>
          ) : (
            logs.map((log) => {
              const sentDate = new Date(log.sent_at)
              const weekNum = getWeekNumber(sentDate)
              const isSelected = selectedLog?.id === log.id

              return (
                <button
                  key={log.id}
                  onClick={() => handlePreview(log)}
                  className={`w-full text-left bg-white rounded-lg shadow-card p-4 transition-all border-l-[3px] ${
                    isSelected
                      ? 'border-pr-gold shadow-card-hover'
                      : 'border-transparent hover:border-pr-gold/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="text-sm font-bold text-pr-text font-serif">
                        Week {weekNum}{' · '}{sentDate.getFullYear()}
                      </div>
                      <div className="text-xs text-pr-muted mt-0.5">
                        {sentDate.toLocaleDateString('en-GB', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </div>
                    </div>
                    <StatusBadge status={log.status} />
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-pr-muted">
                    <span>{log.trend_count} trends</span>
                    <span>{'·'}</span>
                    <span>{log.recipient_count} recipients</span>
                  </div>
                </button>
              )
            })
          )}
        </div>

        {/* Preview panel */}
        <div className="lg:col-span-3">
          {!selectedLog ? (
            <div className="bg-white rounded-lg shadow-card p-12 text-center h-full flex flex-col items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-pr-cream flex items-center justify-center mb-4">
                <span className="text-xl">ðŸ“§</span>
              </div>
              <p className="text-pr-muted text-sm">Select a digest from the left to preview it</p>
            </div>
          ) : loadingPreview ? (
            <div className="bg-white rounded-lg shadow-card p-8 flex items-center justify-center h-64">
              <div className="animate-spin w-8 h-8 border-2 border-pr-gold border-t-transparent rounded-full" />
            </div>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold text-pr-text">
                  Email Preview â€” Week {getWeekNumber(new Date(selectedLog.sent_at))}
                </h2>
                <span className="text-xs text-pr-muted">{previewTrends.length} trends</span>
              </div>
              {previewTrends.length > 0 ? (
                <DigestPreview
                  trends={previewTrends}
                  weekNumber={getWeekNumber(new Date(selectedLog.sent_at))}
                  year={new Date(selectedLog.sent_at).getFullYear()}
                />
              ) : (
                <div className="bg-white rounded-lg shadow-card p-8 text-center text-pr-muted text-sm">
                  No trend data found for this week.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
