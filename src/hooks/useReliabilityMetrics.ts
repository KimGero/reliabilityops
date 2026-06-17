import { useMemo } from 'react'
import type { Endpoint, Incident } from '../types/index.js'
import { calculateMTTR, calculateMTBF, errorBudgetRemainingPct } from '../lib/utils.js'

export interface ReliabilityMetrics {
  totalEndpoints:         number
  operational:            number
  degraded:               number
  outage:                 number
  overallAvailability:    number   // weighted % (operational + degraded) / total
  mttr_minutes:           number | null
  mtbf_hours:             number | null
  avgErrorBudgetRemaining: number  // % remaining across all endpoints
  incidentsLast30d:       number
}

export function useReliabilityMetrics(
  endpoints: Endpoint[],
  incidents: Incident[]
): ReliabilityMetrics {
  return useMemo(() => {
    const op  = endpoints.filter(e => e.status === 'up').length
    const deg = endpoints.filter(e => e.status === 'degraded').length
    const out = endpoints.filter(e => e.status === 'down').length
    const n   = endpoints.length

    const cutoff  = Date.now() - 30 * 86_400_000
    const recent  = incidents.filter(i => new Date(i.started_at).getTime() >= cutoff)

    const avgBudget = n === 0 ? 100 :
      Math.round(
        endpoints.reduce((sum, ep) =>
          sum + errorBudgetRemainingPct(
            ep.slo_target, 30,
            incidents.filter(i => i.endpoint_id === ep.id)
          ), 0
        ) / n
      )

    return {
      totalEndpoints:          n,
      operational:             op,
      degraded:                deg,
      outage:                  out,
      overallAvailability:     n ? Math.round(((op + deg) / n) * 1000) / 10 : 100,
      mttr_minutes:            calculateMTTR(incidents),
      mtbf_hours:              calculateMTBF(incidents),
      avgErrorBudgetRemaining: avgBudget,
      incidentsLast30d:        recent.length,
    }
  }, [endpoints, incidents])
}