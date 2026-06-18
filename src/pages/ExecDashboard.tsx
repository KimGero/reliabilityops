// src/pages/ExecDashboard.tsx
import { useMemo } from 'react'
import { 
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell
} from 'recharts'
import { 
  TrendingUp, TrendingDown, Clock, AlertTriangle, CheckCircle, 
  Activity, Server, BarChart3, ArrowUpRight, ArrowDownRight, Minus
} from 'lucide-react'
import { useEndpoints } from '../hooks/useEndpoints.js'
import { useIncidents } from '../hooks/useIncidents.js'
import { useReliabilityMetrics } from '../hooks/useReliabilityMetrics.js'
import { incidentStatusColor, errorBudgetRemainingPct } from '../lib/utils.js'
import { TopBar } from '../components/TopBar.js'
import type { Incident } from '../types/index.js'

// ─── Colors ──────────────────────────────────────────────────────────────────
const COLORS = {
  green: '#4ade80',
  greenDim: 'rgba(74, 222, 128, 0.15)',
  amber: '#fbbf24',
  red: '#f87171',
  blue: '#60a5fa',
  purple: '#818cf8',
  pink: '#f472b6',
  surface: '#0d1424',
  border: 'rgba(255,255,255,0.07)',
  text: '#dde4f0',
  textMuted: '#566577',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function buildAvailabilityTrend(incidents: Incident[]) {
  return Array.from({ length: 30 }, (_, i) => {
    const date = new Date(Date.now() - (29 - i) * 86_400_000)
    const dayStart = new Date(date).setHours(0, 0, 0, 0)
    const dayEnd = dayStart + 86_400_000

    const downtimeMs = incidents.reduce((sum: number, inc: Incident) => {
      const s = new Date(inc.started_at).getTime()
      const e = inc.resolved_at ? new Date(inc.resolved_at).getTime() : Date.now()
      const overlap = Math.max(0, Math.min(e, dayEnd) - Math.max(s, dayStart))
      return sum + overlap
    }, 0)

    return {
      date: date.toISOString().slice(0, 10),
      label: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      availability: Math.max(0, Math.round((100 - (downtimeMs / 86_400_000) * 100) * 100) / 100),
    }
  })
}

function getTrend(days: { availability: number }[]) {
  if (days.length < 2) return { direction: 'stable', change: 0 }
  const first = days[0].availability
  const last = days[days.length - 1].availability
  const change = last - first
  return {
    direction: change > 0.3 ? 'up' : change < -0.3 ? 'down' : 'stable',
    change: Math.abs(Math.round(change * 100) / 100),
  }
}

// ─── Main Component ──────────────────────────────────────────────────────────
export function ExecDashboard() {
  const { endpoints } = useEndpoints()
  const { incidents } = useIncidents()
  const m = useReliabilityMetrics(endpoints, incidents)
  const trend = buildAvailabilityTrend(incidents)
  const trendInfo = getTrend(trend)

  const endpointsWithBudget = endpoints.map(ep => ({
    ...ep,
    budgetRemaining: errorBudgetRemainingPct(ep.slo_target, 30, incidents.filter(i => i.endpoint_id === ep.id)),
  }))

  const avgBudget = endpoints.length === 0 ? 100 :
    Math.round(endpointsWithBudget.reduce((s, ep) => s + ep.budgetRemaining, 0) / endpoints.length)

  const endpointStatusData = [
    { name: 'Operational', value: endpoints.filter(e => e.status === 'up').length, color: COLORS.green },
    { name: 'Degraded', value: endpoints.filter(e => e.status === 'degraded').length, color: COLORS.amber },
    { name: 'Down', value: endpoints.filter(e => e.status === 'down').length, color: COLORS.red },
    { name: 'Unknown', value: endpoints.filter(e => !e.status || e.status === 'unknown').length, color: COLORS.textMuted },
  ].filter(d => d.value > 0)

  const incidentStatusData = [
    { name: 'Investigating', value: incidents.filter(i => i.status === 'Investigating' && !i.resolved_at).length, color: COLORS.amber },
    { name: 'Degraded', value: incidents.filter(i => i.status === 'Degraded' && !i.resolved_at).length, color: '#fb923c' },
    { name: 'Major Outage', value: incidents.filter(i => i.status === 'Major Outage' && !i.resolved_at).length, color: COLORS.red },
    { name: 'Resolved', value: incidents.filter(i => i.status === 'Resolved').length, color: COLORS.green },
  ].filter(d => d.value > 0)

  const hasActiveIncidents = incidentStatusData.some(d => d.name !== 'Resolved' && d.value > 0)
  const currentAvailability = trend.length > 0 ? trend[trend.length - 1].availability : 100
  const isWithinSLO = currentAvailability >= 99.9

  return (
    <div className="exec-dashboard" style={{ background: 'var(--bg-base)', minHeight: '100vh' }}>

      <TopBar title="Analytics" showBack={true} backTo="/" />

      {/* ─── Page Header ──────────────────────────────────────────────────── */}
      <div style={{
        padding: '20px 32px',
        borderBottom: `1px solid ${COLORS.border}`,
        background: 'var(--bg-surface)',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 2 }}>
              <BarChart3 size={20} style={{ color: COLORS.blue }} />
              <h1 style={{ fontFamily: 'var(--font-head)', fontSize: 20, fontWeight: 700, letterSpacing: '-0.3px' }}>
                Reliability Analytics
              </h1>
            </div>
            <p style={{ color: COLORS.textMuted, fontSize: 13 }}>30-day reliability metrics and incident overview</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 11, color: COLORS.textMuted }}>Current Availability</div>
              <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'var(--font-mono)', color: isWithinSLO ? COLORS.green : COLORS.red }}>
                {currentAvailability.toFixed(2)}%
              </div>
            </div>
            <div style={{
              width: 1,
              height: 40,
              background: COLORS.border,
            }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: COLORS.textMuted }}>
              <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: hasActiveIncidents ? COLORS.red : COLORS.green }} />
              {hasActiveIncidents ? `${incidentStatusData.filter(d => d.name !== 'Resolved').reduce((s, d) => s + d.value, 0)} active` : 'All systems operational'}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Main Content ──────────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 32px 40px' }}>

        {/* ─── KPI Row ────────────────────────────────────────────────────── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 12,
          marginBottom: 24,
        }}>
          <KPI label="Systems" value={m.totalEndpoints} icon={<Server size={14} />} color={COLORS.blue} />
          <KPI
            label="Availability"
            value={`${m.overallAvailability}%`}
            icon={m.overallAvailability >= 99.9 ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
            color={m.overallAvailability >= 99.9 ? COLORS.green : m.overallAvailability >= 99 ? COLORS.amber : COLORS.red}
            trend={trendInfo.direction === 'up' ? <ArrowUpRight size={12} /> : trendInfo.direction === 'down' ? <ArrowDownRight size={12} /> : <Minus size={12} />}
            trendLabel={trendInfo.direction === 'up' ? `+${trendInfo.change}%` : trendInfo.direction === 'down' ? `${trendInfo.change}%` : 'stable'}
          />
          <KPI
            label="Error Budget"
            value={`${avgBudget}%`}
            sub="remaining"
            icon={avgBudget > 50 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
            color={avgBudget > 50 ? COLORS.green : avgBudget > 10 ? COLORS.amber : COLORS.red}
          />
          <KPI
            label="MTTR"
            value={m.mttr_minutes !== null ? `${m.mttr_minutes}m` : '—'}
            sub="avg recovery"
            icon={<Clock size={14} />}
            color={COLORS.purple}
          />
          <KPI
            label="MTBF"
            value={m.mtbf_hours !== null ? `${m.mtbf_hours}h` : '—'}
            sub="between failures"
            icon={<Activity size={14} />}
            color={COLORS.pink}
          />
        </div>

        {/* ─── LARGE AVAILABILITY CHART ───────────────────────────────────── */}
        <div style={{
          background: 'var(--bg-surface)',
          border: `1px solid var(--border)`,
          borderRadius: 10,
          padding: '24px 28px 28px 28px',
          marginBottom: 24,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <div>
              <h2 style={{ fontFamily: 'var(--font-head)', fontSize: 16, fontWeight: 700, letterSpacing: '-0.3px' }}>
                30-Day Availability Trend
              </h2>
              <span style={{ fontSize: 12, color: COLORS.textMuted }}>Rolling 30-day window · Data updates every 60 seconds</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ display: 'inline-block', width: 12, height: 3, background: COLORS.green }} />
                <span style={{ color: COLORS.textMuted }}>Availability</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ display: 'inline-block', width: 12, height: 3, background: '#475569', borderStyle: 'dashed' }} />
                <span style={{ color: COLORS.textMuted }}>SLO Target (99.9%)</span>
              </div>
            </div>
          </div>

          {trend.length > 0 && (
            <>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={trend} margin={{ top: 8, right: 8, bottom: 8, left: -20 }}>
                  <defs>
                    <linearGradient id="availabilityGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={COLORS.green} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={COLORS.green} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="label"
                    tick={{ fontSize: 10, fill: COLORS.textMuted, fontFamily: 'IBM Plex Mono' }}
                    interval={4}
                    tickLine={false}
                    axisLine={false}
                    dy={4}
                  />
                  <YAxis
                    domain={[98, 100]}
                    tick={{ fontSize: 10, fill: COLORS.textMuted, fontFamily: 'IBM Plex Mono' }}
                    tickLine={false}
                    axisLine={false}
                    dx={-4}
                    ticks={[98, 98.5, 99, 99.5, 100]}
                  />
                  <Tooltip
                    contentStyle={{
                      background: COLORS.surface,
                      border: `1px solid ${COLORS.border}`,
                      borderRadius: 8,
                      fontSize: 12,
                      fontFamily: 'IBM Plex Mono',
                      padding: '10px 14px',
                    }}
                    formatter={(v: number) => [`${v.toFixed(3)}%`, 'Availability']}
                    labelFormatter={(label) => `Date: ${label}`}
                  />
                  <Area
                    type="monotone"
                    dataKey="availability"
                    stroke={COLORS.green}
                    strokeWidth={2.5}
                    fill="url(#availabilityGradient)"
                    dot={false}
                    activeDot={{ r: 4, fill: COLORS.green }}
                  />
                  {/* SLO Target Line */}
                  <Area
                    type="monotone"
                    dataKey={() => 99.9}
                    stroke="#475569"
                    strokeWidth={1.5}
                    strokeDasharray="6 4"
                    fill="none"
                    dot={false}
                    activeDot={false}
                  />
                </AreaChart>
              </ResponsiveContainer>

              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: 12,
                fontSize: 11,
                color: COLORS.textMuted,
                borderTop: `1px solid ${COLORS.border}`,
                paddingTop: 12,
              }}>
                <div>
                  <span>Start: {trend[0].label} · {trend[0].availability.toFixed(2)}%</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <span>Min: {Math.min(...trend.map(d => d.availability)).toFixed(2)}%</span>
                  <span>Max: {Math.max(...trend.map(d => d.availability)).toFixed(2)}%</span>
                  <span style={{ fontWeight: 600, color: isWithinSLO ? COLORS.green : COLORS.red }}>
                    Current: {trend[trend.length - 1].availability.toFixed(2)}%
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* ─── SLO PERFORMANCE ────────────────────────────────────────────── */}
        <div style={{
          background: 'var(--bg-surface)',
          border: `1px solid var(--border)`,
          borderRadius: 10,
          padding: '18px 20px',
          marginBottom: 24,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <div>
              <h3 style={{ fontSize: 13, fontWeight: 600, fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', color: 'var(--text-primary)' }}>
                SLO Performance
              </h3>
              <span style={{ fontSize: 11, color: COLORS.textMuted }}>Error budget remaining per endpoint · 30-day rolling window</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 10, color: COLORS.textMuted }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: COLORS.green }} />
                Healthy (&gt;50%)
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: COLORS.amber }} />
                Warning (10-50%)
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: COLORS.red }} />
                Critical (&lt;10%)
              </span>
            </div>
          </div>

          {endpointsWithBudget.length === 0 ? (
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              height: 80, 
              color: COLORS.textMuted,
              fontSize: 13,
            }}>
              No endpoints configured — add endpoints to track SLO performance
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {endpointsWithBudget.slice(0, 10).map((ep) => {
                const budget = ep.budgetRemaining
                const color = budget > 50 ? COLORS.green : budget > 10 ? COLORS.amber : COLORS.red
                const status = budget > 50 ? 'Healthy' : budget > 10 ? 'Warning' : 'Critical'
                const barWidth = Math.max(Math.min(budget, 100), 0)

                return (
                  <div key={ep.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <span style={{
                      fontSize: 12,
                      color: 'var(--text-primary)',
                      minWidth: 140,
                      maxWidth: 140,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      fontWeight: 500,
                    }}>
                      {ep.name}
                    </span>
                    <div style={{
                      flex: 1,
                      height: 8,
                      background: 'var(--bg-elevated)',
                      borderRadius: 4,
                      overflow: 'hidden',
                      position: 'relative',
                    }}>
                      <div style={{
                        width: `${barWidth}%`,
                        height: '100%',
                        background: color,
                        borderRadius: 4,
                        transition: 'width 0.6s ease, background 0.3s ease',
                      }} />
                      <div style={{
                        position: 'absolute',
                        left: '10%',
                        top: 0,
                        height: '100%',
                        width: 1,
                        background: 'rgba(255,255,255,0.15)',
                      }} />
                    </div>
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 12,
                      fontWeight: 600,
                      color,
                      minWidth: 44,
                      textAlign: 'right',
                    }}>
                      {budget}%
                    </span>
                    <span style={{
                      fontSize: 9,
                      fontWeight: 600,
                      padding: '2px 10px',
                      borderRadius: 10,
                      background: `${color}20`,
                      color,
                      fontFamily: 'var(--font-mono)',
                      minWidth: 56,
                      textAlign: 'center',
                    }}>
                      {status}
                    </span>
                    <span style={{
                      fontSize: 9,
                      color: COLORS.textMuted,
                      fontFamily: 'var(--font-mono)',
                      minWidth: 48,
                      textAlign: 'right',
                    }}>
                      SLO {ep.slo_target}%
                    </span>
                  </div>
                )
              })}
            </div>
          )}
          {endpointsWithBudget.length > 10 && (
            <div style={{ textAlign: 'center', marginTop: 10, fontSize: 11, color: COLORS.textMuted }}>
              Showing 10 of {endpointsWithBudget.length} endpoints
            </div>
          )}
        </div>

        {/* ─── Bottom Row ──────────────────────────────────────────────────── */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 16,
        }}>
          {/* Health Distribution */}
          <div style={{
            background: 'var(--bg-surface)',
            border: `1px solid var(--border)`,
            borderRadius: 10,
            padding: '18px 20px',
          }}>
            <h3 style={{ fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', color: 'var(--text-primary)', marginBottom: 12 }}>
              System Health
            </h3>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, height: 120 }}>
              {endpointStatusData.length > 0 ? (
                <>
                  <div style={{ width: 90, height: 90 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={endpointStatusData}
                          dataKey="value"
                          innerRadius={22}
                          outerRadius={40}
                          stroke={COLORS.surface}
                          strokeWidth={2}
                        >
                          {endpointStatusData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {endpointStatusData.map((item) => (
                      <div key={item.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: item.color, flexShrink: 0 }} />
                        <span style={{ color: COLORS.textMuted, minWidth: 70 }}>{item.name}</span>
                        <span style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{item.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ color: COLORS.textMuted, fontSize: 13 }}>No endpoints configured</div>
              )}
            </div>
          </div>

          {/* Incident Activity */}
          <div style={{
            background: 'var(--bg-surface)',
            border: `1px solid var(--border)`,
            borderRadius: 10,
            padding: '18px 20px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <h3 style={{ fontSize: 12, fontWeight: 600, fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', color: 'var(--text-primary)' }}>
                Recent Incidents
              </h3>
              {incidentStatusData.filter(d => d.name !== 'Resolved' && d.value > 0).map(d => (
                <span key={d.name} style={{
                  fontSize: 9,
                  padding: '1px 8px',
                  borderRadius: 10,
                  background: `${d.color}20`,
                  color: d.color,
                  fontFamily: 'var(--font-mono)',
                }}>
                  {d.value} {d.name}
                </span>
              ))}
            </div>
            <div style={{ height: 120, overflowY: 'auto', paddingRight: 4 }}>
              {incidents.length === 0 ? (
                <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, color: COLORS.textMuted }}>
                  <CheckCircle size={20} style={{ opacity: 0.2 }} />
                  <span style={{ fontSize: 13 }}>No incidents recorded</span>
                </div>
              ) : (
                incidents.slice(0, 5).map((inc) => {
                  const isOpen = !inc.resolved_at
                  const color = incidentStatusColor(inc.status)
                  return (
                    <div key={inc.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '6px 8px',
                      borderRadius: 4,
                      background: isOpen ? `${COLORS.red}08` : 'transparent',
                      borderLeft: `2px solid ${isOpen ? COLORS.red : COLORS.green}`,
                      marginBottom: 4,
                    }}>
                      <span style={{ fontSize: 12, fontWeight: 500, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {inc.endpoint?.name ?? 'Unknown'}
                      </span>
                      <span style={{
                        fontSize: 9,
                        fontWeight: 600,
                        padding: '1px 8px',
                        borderRadius: 10,
                        background: `${color}20`,
                        color,
                        fontFamily: 'var(--font-mono)',
                      }}>
                        {inc.status}
                      </span>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>

        {/* ─── Footer ───────────────────────────────────────────────────────── */}
        <div style={{ textAlign: 'center', paddingTop: 20, marginTop: 20, fontSize: 11, color: COLORS.textMuted, borderTop: `1px solid ${COLORS.border}` }}>
          Data updates every 60 seconds · Last 30 days rolling window · SLO target: 99.9%
        </div>
      </div>
    </div>
  )
}

// ─── KPI Component ────────────────────────────────────────────────────────────
function KPI({
  label,
  value,
  sub,
  icon,
  color,
  trend,
  trendLabel,
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ReactNode
  color: string
  trend?: React.ReactNode
  trendLabel?: string
}) {
  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: `1px solid var(--border)`,
      borderRadius: 8,
      padding: '12px 14px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
        <span style={{ fontSize: 9, color: COLORS.textMuted, fontFamily: 'var(--font-mono)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {label}
        </span>
        <span style={{ color, opacity: 0.6 }}>{icon}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
        <span style={{ fontSize: 18, fontWeight: 600, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
          {value}
        </span>
        {trend && trendLabel && (
          <span style={{
            fontSize: 9,
            color: trendLabel.includes('+') ? COLORS.green : trendLabel.includes('-') ? COLORS.red : COLORS.textMuted,
            fontFamily: 'var(--font-mono)',
            display: 'flex',
            alignItems: 'center',
            gap: 2,
          }}>
            {trend} {trendLabel}
          </span>
        )}
      </div>
      {sub && <span style={{ fontSize: 9, color: COLORS.textMuted }}>{sub}</span>}
    </div>
  )
}