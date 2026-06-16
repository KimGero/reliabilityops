
import { useState } from "react"
import { LineChart, Line, ResponsiveContainer, Tooltip } from "recharts"
import { Trash2, RefreshCw, ChevronDown, ChevronUp, ExternalLink } from "lucide-react"
import { useCheckHistory } from '../hooks/useCheckHistory.js'  
import { supabase } from '../lib/supabase.js'  
import { statusColor, statusLabel, formatRelativeTime, formatResponseTime, truncateUrl, errorBudgetRemainingPct } from '../lib/utils.js'  
import type { Endpoint, Incident } from '../types/index.js'  

interface Props {
  endpoint: Endpoint
  incidents: Incident[]
  onDelete: (id: string) => void
}

export function EndpointCard({ endpoint, incidents, onDelete }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [retrying, setRetrying] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const { history, stats, loading: histLoading } = useCheckHistory(endpoint.id, expanded ? 60 : 20)

  const status = endpoint.status ?? 'unknown'
  const color = statusColor(status)
  const isDown = status === 'down'
  const isDeg = status === 'degraded'
  const epIncidents = incidents.filter(i => i.endpoint_id === endpoint.id)
  const budgetPct = errorBudgetRemainingPct(endpoint.slo_target, 30, epIncidents)
  const budgetColor = budgetPct > 50 ? '#4ade80' : budgetPct > 10 ? '#fbbf24' : '#f87171'

  const handleRetry = async () => {
    setRetrying(true)
    try {
      const start = Date.now()
      const res = await fetch(endpoint.url, { method: endpoint.method, signal: AbortSignal.timeout(endpoint.timeout_ms) }).catch(e => ({ ok: false, status: null as number | null, error: e.message }))
      const rt = Date.now() - start
      const isResp = 'status' in res && res.status !== null
      const code = isResp ? (res as Response).status : null
      const isUp = isResp ? code === endpoint.expected_status : false
      await supabase.from('checks').insert({ endpoint_id: endpoint.id, is_up: isUp, status_code: code, response_time_ms: rt, error_message: !isResp ? (res as { error: string }).error : null })
    } finally { setRetrying(false) }
  }

  const handleDelete = async () => {
    if (!confirm(`Remove ${endpoint.name}?`)) return
    setDeleting(true)
    try { await onDelete(endpoint.id) } finally { setDeleting(false) }
  }

  return (
    <article className={`endpoint-card${isDown ? ' endpoint-card--down' : ''}${isDeg ? ' endpoint-card--degraded' : ''}`}>
      <div className="endpoint-card__header">
        <div className="endpoint-card__identity">
          <span className="status-dot" style={{ '--dot-color': color } as React.CSSProperties} />
          <div>
            <h3 className="endpoint-name">{endpoint.name}</h3>
            <a href={endpoint.url} target="_blank" rel="noopener noreferrer" className="endpoint-url">
              {truncateUrl(endpoint.url, 55)}&nbsp;<ExternalLink size={10} style={{ display: 'inline', opacity: 0.5 }} />
            </a>
          </div>
        </div>
        <div className="endpoint-card__meta">
          <span className="endpoint-badge" style={{ color }}>{statusLabel(status)}</span>
          <div className="endpoint-metrics">
            <span className="metric">{formatResponseTime(endpoint.last_response_time_ms)}</span>
            <span className="metric-sep">·</span>
            <span className="metric muted">{formatRelativeTime(endpoint.last_checked_at)}</span>
          </div>
          <div className="endpoint-actions">
            <button onClick={handleRetry} disabled={retrying} className="icon-btn" title="Re-check now">
              <RefreshCw size={14} className={retrying ? 'spin' : ''} />
            </button>
            <button onClick={handleDelete} disabled={deleting} className="icon-btn icon-btn--danger" title="Remove">
              <Trash2 size={14} />
            </button>
            <button onClick={() => setExpanded(e => !e)} className="icon-btn" title={expanded ? 'Collapse' : 'Expand'}>
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>
        </div>
      </div>

      {!histLoading && history.length > 1 && (
        <div className="sparkline-wrap">
          <ResponsiveContainer width="100%" height={40}>
            <LineChart data={history} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
              <Line type="monotone" dataKey="response_time_ms" stroke={color} strokeWidth={1.5} dot={false} isAnimationActive={false} />
              <Tooltip contentStyle={{ background: '#0f1420', border: '1px solid #1e2a3a', fontSize: 11, fontFamily: 'IBM Plex Mono' }} labelFormatter={v => new Date(String(v)).toLocaleTimeString()} formatter={(v: number) => [`${v}ms`, 'Response']} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {expanded && (
        <div className="endpoint-card__expanded">
          <div className="expanded-stats">
            <StatPill label="SLO TARGET" value={`${endpoint.slo_target}%`} />
            <StatPill label="24H UPTIME" value={endpoint.uptime_24h != null ? `${endpoint.uptime_24h}%` : '—'} color={endpoint.uptime_24h != null ? (endpoint.uptime_24h >= endpoint.slo_target ? 'green' : endpoint.uptime_24h >= 95 ? 'amber' : 'red') : undefined} />            <StatPill label="AVG RESPONSE" value={formatResponseTime(stats.avg_response_time_ms)} />
            <StatPill label="P95" value={`${stats.p95_response_time_ms}ms`} />
            <StatPill label="CHECKS" value={stats.total_checks.toString()} />
            <StatPill label="METHOD" value={endpoint.method} />
            <StatPill label="INTERVAL" value={`${endpoint.interval_seconds}s`} />
            <StatPill label="CONS. FAILS" value={endpoint.consecutive_failures.toString()} color={endpoint.consecutive_failures >= 3 ? 'red' : endpoint.consecutive_failures > 0 ? 'amber' : undefined} />
            <div className="budget-ring-wrap">
              <svg width="28" height="28" viewBox="0 0 28 28">
                <circle cx="14" cy="14" r="11" fill="none" stroke="#1e2a3a" strokeWidth="3" />
                <circle cx="14" cy="14" r="11" fill="none" stroke={budgetColor} strokeWidth="3"
                  strokeDasharray={`${(budgetPct / 100) * 69.12} 69.12`}
                  strokeLinecap="round" transform="rotate(-90 14 14)" />
              </svg>
              <div>
                <div className="budget-ring-label">ERROR BUDGET</div>
                <div className="budget-ring-pct" style={{ color: budgetColor }}>{budgetPct}%</div>
              </div>
            </div>
          </div>
          {history.length > 2 && (
            <div className="history-chart">
              <ResponsiveContainer width="100%" height={80}>
                <LineChart data={history} margin={{ top: 4, right: 4, bottom: 4, left: 0 }}>
                  <Line type="monotone" dataKey="response_time_ms" stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Tooltip contentStyle={{ background: '#0f1420', border: '1px solid #1e2a3a', fontSize: 11 }} labelFormatter={v => new Date(String(v)).toLocaleString()} formatter={(v: number) => [`${v}ms`, 'Response']} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </article>
  )
}

function StatPill({ label, value, color }: { label: string; value: string; color?: 'green' | 'red' | 'amber' }) {
  return (
    <div className="stat-pill">
      <span className="stat-pill__label">{label}</span>
      <span className={`stat-pill__value ${color ? `stat-pill__value--${color}` : ''}`}>{value}</span>
    </div>
  )
}

