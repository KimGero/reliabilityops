
import type { Endpoint, Incident } from '../types/index.js'
import { calculateMTTR, errorBudgetRemainingPct } from '../lib/utils.js'

interface Props {
  endpoints:     Endpoint[]
  incidents:     Incident[]
  incidentCount: number
}

export function StatsBar({ endpoints, incidents, incidentCount }: Props) {
  const total    = endpoints.length
  const up       = endpoints.filter(e => e.status === 'up').length
  const down     = endpoints.filter(e => e.status === 'down').length
  const degraded = endpoints.filter(e => e.status === 'degraded').length
  const times    = endpoints.map(e => e.last_response_time_ms).filter((t): t is number => typeof t === 'number')
  const avgTime  = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : null
  const allHealthy = down === 0 && degraded === 0

  const mttr = calculateMTTR(incidents)
  const avgBudget = endpoints.length === 0 ? 100 :
    Math.round(
      endpoints.reduce((s, ep) =>
        s + errorBudgetRemainingPct(ep.slo_target, 30, incidents.filter(i => i.endpoint_id === ep.id)), 0
      ) / endpoints.length
    )

  return (
    <div className="stats-bar">
      <div className="stat-group">
        <div className={`system-status ${allHealthy ? 'ok' : 'incident'}`}>
          <span className="pulse-dot" />
          <span>{allHealthy ? 'ALL SYSTEMS OPERATIONAL' : `${down + degraded} SYSTEM${down + degraded !== 1 ? 'S' : ''} IMPACTED`}</span>
        </div>
      </div>

      <div className="stat-group divider">
        <Stat label="ENDPOINTS" value={total.toString()} />
        <Stat label="UP"        value={up.toString()}    color="green" />
        {degraded > 0 && <Stat label="DEGRADED" value={degraded.toString()} color="amber" />}
        {down > 0     && <Stat label="DOWN"     value={down.toString()}     color="red"   />}
      </div>

      <div className="stat-group divider">
        <Stat label="AVG RESPONSE"
          value={avgTime !== null ? `${avgTime}ms` : '—'}
          color={avgTime !== null && avgTime > 1500 ? 'amber' : undefined} />
        <Stat label="INCIDENTS" value={incidentCount.toString()} color={incidentCount > 0 ? 'red' : undefined} />
      </div>

      <div className="stat-group divider">
        <Stat label="MTTR"         value={mttr !== null ? `${mttr}m` : '—'} />
        <Stat label="ERROR BUDGET" value={`${avgBudget}%`} color={avgBudget < 10 ? 'red' : avgBudget < 50 ? 'amber' : undefined} />
      </div>
    </div>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color?: 'green' | 'red' | 'amber' | 'muted' }) {
  return (
    <div className="stat">
      <span className="stat-label">{label}</span>
      <span className={`stat-value${color ? ` stat-value--${color}` : ''}`}>{value}</span>
    </div>
  )
}
