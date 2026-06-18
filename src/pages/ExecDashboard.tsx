// src/pages/ExecDashboard.tsx
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { useEndpoints } from '../hooks/useEndpoints.js'
import { useIncidents } from '../hooks/useIncidents.js'
import { useReliabilityMetrics } from '../hooks/useReliabilityMetrics.js'
import { incidentStatusColor, formatDuration } from '../lib/utils.js'
import type { Incident } from '../types/index.js'

// ─── Build 30-day availability trend ──────────────────────────────────────
function buildTrend(incidents: Incident[]) {
  return Array.from({ length: 30 }, (_, i) => {
    const date = new Date(Date.now() - (29 - i) * 86_400_000)
    const dateStr = date.toISOString().slice(0, 10)
    const dayStart = date.setHours(0, 0, 0, 0)
    const dayEnd = dayStart + 86_400_000

    // sum downtime minutes for incidents overlapping this day
    const downtimeMs = incidents.reduce((sum: number, inc: Incident) => {
      const s = new Date(inc.started_at).getTime()
      const e = inc.resolved_at ? new Date(inc.resolved_at).getTime() : Date.now()
      const overlap = Math.max(0, Math.min(e, dayEnd) - Math.max(s, dayStart))
      return sum + overlap
    }, 0)

    const downtimePct = (downtimeMs / 86_400_000) * 100
    return {
      date: dateStr.slice(5),  // "MM-DD"
      avail: Math.max(0, Math.round((100 - downtimePct) * 100) / 100),
    }
  })
}

export function ExecDashboard() {
  const { endpoints } = useEndpoints()
  const { incidents } = useIncidents()
  const m = useReliabilityMetrics(endpoints, incidents)
  const trend = buildTrend(incidents)

  return (
    <div className="exec-dashboard">
      {/* ─── KPI strip ─── */}
      <div className="exec-metric-grid">
        <MetricCard label="SYSTEMS" value={m.totalEndpoints.toString()} />
        <MetricCard 
          label="AVAILABILITY" 
          value={`${m.overallAvailability}%`}
          variant={m.overallAvailability >= 99.9 ? 'highlight' : m.overallAvailability >= 99 ? 'warn' : 'crit'} 
        />
        <MetricCard 
          label="ERROR BUDGET" 
          value={`${m.avgErrorBudgetRemaining}%`} 
          sub="remaining 30d"
          variant={m.avgErrorBudgetRemaining > 50 ? undefined : m.avgErrorBudgetRemaining > 10 ? 'warn' : 'crit'} 
        />
        <MetricCard 
          label="MTTR" 
          value={m.mttr_minutes !== null ? `${m.mttr_minutes}m` : '—'} 
          sub="avg recovery" 
        />
        <MetricCard 
          label="MTBF" 
          value={m.mtbf_hours !== null ? `${m.mtbf_hours}h` : '—'} 
          sub="avg between failures" 
        />
      </div>

      {/* ─── Status badges ─── */}
      <div className="exec-status-row">
        <StatusBadge label="OPERATIONAL" count={m.operational} color="#4ade80" />
        <StatusBadge label="DEGRADED" count={m.degraded} color="#fbbf24" />
        <StatusBadge label="OUTAGE" count={m.outage} color="#f87171" />
        <StatusBadge label="INCIDENTS 30D" count={m.incidentsLast30d} color="#60a5fa" />
      </div>

      {/* ─── 30-day availability chart ─── */}
      <div className="exec-chart-card">
        <h3>30-Day Availability Trend</h3>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={trend} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
            <defs>
              <linearGradient id="availGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#4ade80" stopOpacity={0.25} />
                <stop offset="95%" stopColor="#4ade80" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#475569', fontFamily: 'IBM Plex Mono' }} interval={4} />
            <YAxis domain={[99, 100]} tick={{ fontSize: 10, fill: '#475569', fontFamily: 'IBM Plex Mono' }} />
            <Tooltip
              contentStyle={{ background: '#0f1420', border: '1px solid #1e2a3a', fontSize: 11, fontFamily: 'IBM Plex Mono' }}
              formatter={(v: number) => [`${v.toFixed(3)}%`, 'Availability']}
            />
            <Area type="monotone" dataKey="avail" stroke="#4ade80" fill="url(#availGrad)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* ─── Incident table ─── */}
      <div className="exec-incidents">
        <h3>Recent Incidents</h3>
        {incidents.length === 0 && (
          <div style={{ color: 'var(--text-secondary)', fontSize: 12 }}>No incidents.</div>
        )}
        {incidents.slice(0, 10).map((inc: Incident) => {
          const isOpen = !inc.resolved_at
          const sc = incidentStatusColor(inc.status)
          return (
            <div key={inc.id} className="exec-inc-row">
              <span className="exec-inc-dot" style={{ background: isOpen ? '#f87171' : '#4ade80' }} />
              <span className="exec-inc-name">{inc.endpoint?.name ?? '—'}</span>
              <span className="exec-inc-date">{inc.started_at.slice(0, 10)}</span>
              {inc.resolved_at && (
                <span className="exec-inc-dur">
                  {formatDuration(new Date(inc.resolved_at).getTime() - new Date(inc.started_at).getTime())}
                </span>
              )}
              <span className="exec-inc-status" style={{ color: sc, background: `${sc}18` }}>{inc.status}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── MetricCard ──────────────────────────────────────────────────────────────
function MetricCard({ label, value, sub, variant }: { label: string; value: string; sub?: string; variant?: 'highlight' | 'warn' | 'crit' }) {
  return (
    <div className={`metric-card${variant ? ` metric-card--${variant}` : ''}`}>
      <span className="metric-card__label">{label}</span>
      <span className="metric-card__value">{value}</span>
      {sub && <span className="metric-card__sub">{sub}</span>}
    </div>
  )
}

// ─── StatusBadge ─────────────────────────────────────────────────────────────
function StatusBadge({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="status-badge">
      <span className="status-badge__dot" style={{ background: color }} />
      <span className="status-badge__label">{label}</span>
      <span className="status-badge__count" style={{ color }}>{count}</span>
    </div>
  )
}