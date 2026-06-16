// src/lib/utils.ts
import type { EndpointStatus, IncidentStatus, CheckHistory, Incident } from '../types/index.js'

// ─── Status ────────────────────────────────────────────────────

export function deriveStatus(isUp: boolean | null, rt: number | null): EndpointStatus {
  if (isUp === null) return 'unknown'
  if (!isUp) return 'down'
  if (rt !== null && rt > 3000) return 'degraded'
  return 'up'
}

// ─── Only ONE statusColor ─────────────────────────────────────
export function statusColor(s: EndpointStatus): string {
  const colors: Record<EndpointStatus, string> = {
    up: '#4ade80',
    degraded: '#fbbf24',
    down: '#f87171',
    unknown: '#475569'
  }
  return colors[s]
}

// ─── Only ONE statusLabel ─────────────────────────────────────
export function statusLabel(s: EndpointStatus): string {
  const labels: Record<EndpointStatus, string> = {
    up: 'UP',
    degraded: 'DEGRADED',
    down: 'DOWN',
    unknown: 'UNKNOWN'
  }
  return labels[s]
}

// ─── Only ONE incidentStatusColor ─────────────────────────────
export function incidentStatusColor(s: IncidentStatus): string {
  const colors: Record<IncidentStatus, string> = {
    'Investigating': '#fbbf24',
    'Degraded': '#fb923c',
    'Major Outage': '#f87171',
    'Resolved': '#4ade80'
  }
  return colors[s]
}

// ── Time ──────────────────────────────────────────────────────

export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return 'Never'
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60)    return `${s}s ago`
  if (s < 3600)  return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return `${Math.floor(s / 86400)}d ago`
}

export function formatDuration(ms: number): string {
  if (ms < 1000)  return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`
}

export function formatResponseTime(ms: number | null | undefined): string {
  if (ms === null || ms === undefined) return '—'
  return `${ms}ms`
}

// ── URL ──────────────────────────────────────────────────────

export function truncateUrl(url: string, max = 55): string {
  try {
    const p = new URL(url)
    const d = `${p.hostname}${p.pathname}`
    return d.length > max ? d.slice(0, max) + '…' : d
  } catch { return url.length > max ? url.slice(0, max) + '…' : url }
}

export function isValidUrl(url: string): boolean {
  try { return ['http:', 'https:'].includes(new URL(url).protocol) }
  catch { return false }
}

// ── Statistics ────────────────────────────────────────────────

export function calculateUptime(history: CheckHistory[]): number {
  if (!history.length) return 100
  return Math.round((history.filter(c => c.is_up).length / history.length) * 1000) / 10
}

export function calculateP95(values: number[]): number {
  if (!values.length) return 0
  const s = [...values].sort((a, b) => a - b)
  return s[Math.floor(s.length * 0.95)] ?? s[s.length - 1]
}

export function calculateAvgResponseTime(history: CheckHistory[]): number {
  const times = history.map(c => c.response_time_ms).filter((t): t is number => t !== null)
  if (!times.length) return 0
  return Math.round(times.reduce((a, b) => a + b, 0) / times.length)
}

// ── SLO / Error Budget ──────────────────────────────────────

export function errorBudgetMinutes(sloTarget: number, periodDays: number): number {
  return (1 - sloTarget / 100) * periodDays * 24 * 60
}

export function consumedBudgetMinutes(incidents: Incident[], periodDays: number): number {
  const cutoff = new Date(Date.now() - periodDays * 86400000)
  return incidents
    .filter(i => new Date(i.started_at) >= cutoff && !!i.resolved_at)
    .reduce((sum, i) => {
      return sum + (new Date(i.resolved_at!).getTime() - new Date(i.started_at).getTime()) / 60000
    }, 0)
}

export function errorBudgetRemainingPct(sloTarget: number, periodDays: number, incidents: Incident[]): number {
  const total = errorBudgetMinutes(sloTarget, periodDays)
  if (!total) return 100
  return Math.max(0, Math.round(((total - consumedBudgetMinutes(incidents, periodDays)) / total) * 100))
}

// ── MTTR / MTBF ──────────────────────────────────────────────

export function calculateMTTR(incidents: Incident[]): number | null {
  const resolved = incidents.filter(i => !!i.resolved_at)
  if (!resolved.length) return null
  const ms = resolved.reduce((s, i) =>
    s + (new Date(i.resolved_at!).getTime() - new Date(i.started_at).getTime()), 0)
  return Math.round(ms / resolved.length / 60000)
}

export function calculateMTBF(incidents: Incident[]): number | null {
  if (incidents.length < 2) return null
  const sorted = [...incidents].sort((a, b) =>
    new Date(a.started_at).getTime() - new Date(b.started_at).getTime())
  let gap = 0
  for (let i = 1; i < sorted.length; i++)
    gap += new Date(sorted[i].started_at).getTime() - new Date(sorted[i - 1].started_at).getTime()
  return Math.round(gap / (sorted.length - 1) / 3600000)
}

// ── Backoff / Retry ──────────────────────────────────────────

export function backoffDelay(attempt: number, baseMs = 1000, maxMs = 30000): number {
  return Math.min(baseMs * Math.pow(2, attempt), maxMs)
}

export async function retryWithBackoff<T>(fn: () => Promise<T>, maxAttempts = 3, baseMs = 1000): Promise<T> {
  let last: unknown
  for (let i = 0; i < maxAttempts; i++) {
    try { return await fn() } catch (err) {
      last = err
      if (i < maxAttempts - 1) await new Promise(r => setTimeout(r, backoffDelay(i, baseMs)))
    }
  }
  throw last
}

// ── Local Identity ────────────────────────────────────────────

const ID_KEY   = 'reliabilityops_user_id'
const NAME_KEY = 'reliabilityops_user_name'

export function getLocalUserId(): string {
  let id = localStorage.getItem(ID_KEY)
  if (!id) { id = crypto.randomUUID(); localStorage.setItem(ID_KEY, id) }
  return id
}

export function getLocalUserName(): string {
  return localStorage.getItem(NAME_KEY) || 'Engineer'
}

export function setLocalUserName(name: string): void {
  localStorage.setItem(NAME_KEY, name.trim() || 'Engineer')
}