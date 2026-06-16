// ─── Fix imports ─────────────────────────────────────────────
import { useState, useEffect, useCallback } from 'react'
import { supabase, fetchCheckHistory } from '../lib/supabase.js'
import type { CheckHistory, EndpointStats } from '../types/index.js'
import { calculateUptime, calculateAvgResponseTime, calculateP95 } from '../lib/utils.js'

export function useCheckHistory(endpointId: string, limit = 60) {
  const [history, setHistory] = useState<CheckHistory[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await fetchCheckHistory(endpointId, limit)
    setHistory(data as CheckHistory[])
    setLoading(false)
  }, [endpointId, limit])

  useEffect(() => {
    load()

    const ch = supabase
      .channel(`history-${endpointId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'checks',
        filter: `endpoint_id=eq.${endpointId}`,
      }, ({ new: c }: { new: CheckHistory }) => {  // ← Fixed: explicit type
        setHistory(prev => {
          const next = [...prev, c]
          return next.length > limit ? next.slice(-limit) : next
        })
      })
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [endpointId, limit, load])

  const times = history.map(c => c.response_time_ms).filter((t): t is number => t !== null)
  const stats: EndpointStats = {
    uptime_percentage: calculateUptime(history),
    avg_response_time_ms: calculateAvgResponseTime(history),
    p95_response_time_ms: calculateP95(times),
    total_checks: history.length,
  }

  return { history, stats, loading, reload: load }
}