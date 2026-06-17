import { useMemo } from 'react'
import type { Endpoint, Incident } from '../types/index.js'
import { errorBudgetMinutes, consumedBudgetMinutes, errorBudgetRemainingPct } from '../lib/utils.js'

export type BudgetStatus = 'healthy' | 'warning' | 'critical'

export interface SLOData {
  target:                     number   // e.g. 99.9
  remaining30d:               number   // % of budget left
  totalBudgetMinutes:         number   // allowed downtime this period
  consumedBudgetMinutes:      number   // actual downtime from incidents
  budgetStatus:               BudgetStatus
}

export function useSLO(endpoint: Endpoint, incidents: Incident[]): SLOData {
  return useMemo(() => {
    const relevant  = incidents.filter(i => i.endpoint_id === endpoint.id)
    const total     = errorBudgetMinutes(endpoint.slo_target, 30)
    const consumed  = consumedBudgetMinutes(relevant, 30)
    const remaining = errorBudgetRemainingPct(endpoint.slo_target, 30, relevant)

    return {
      target:                endpoint.slo_target,
      remaining30d:          remaining,
      totalBudgetMinutes:    Math.round(total * 10) / 10,
      consumedBudgetMinutes: Math.round(consumed * 10) / 10,
      budgetStatus:
        remaining > 50 ? 'healthy' :
        remaining > 10 ? 'warning' : 'critical',
    }
  }, [endpoint, incidents])
}