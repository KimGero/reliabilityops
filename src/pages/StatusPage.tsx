// src/pages/StatusPage.tsx
import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import type { Endpoint, Incident } from '../types/index.js'
import { statusColor, formatRelativeTime, formatDuration } from '../lib/utils.js'

// ─── 90-day uptime heatmap ──────────────────────────────────────────────────────

function UptimeHeatmap({ endpointId }: { endpointId: string }) {
  const [days, setDays] = useState<Array<{ date: string; pct: number }>>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const since = new Date(Date.now() - 90 * 86_400_000).toISOString()
      const { data } = await supabase
        .from('checks')
        .select('checked_at, is_up')
        .eq('endpoint_id', endpointId)
        .gte('checked_at', since)
        .order('checked_at', { ascending: true })

      if (!data) { setLoading(false); return }

      const byDate: Record<string, { up: number; total: number }> = {}
      for (const c of data) {
        const d = c.checked_at?.slice(0, 10) ?? ''
        if (!byDate[d]) byDate[d] = { up: 0, total: 0 }
        byDate[d].total++
        if (c.is_up) byDate[d].up++
      }

      const result = Array.from({ length: 90 }, (_, i) => {
        const date = new Date(Date.now() - (89 - i) * 86_400_000).toISOString().slice(0, 10)
        const d = byDate[date]
        const pct = d ? Math.round((d.up / d.total) * 100) : -1
        return { date, pct }
      })

      setDays(result)
      setLoading(false)
    }
    load()
  }, [endpointId])

  if (loading) return <div style={{ flex: 1, height: 20, background: 'var(--bg-elevated)', borderRadius: 2 }} />

  return (
    <div style={{ display: 'flex', gap: 2, flex: 1, alignItems: 'center' }}>
      {days.map(d => (
        <div
          key={d.date}
          title={`${d.date}: ${d.pct < 0 ? 'No data' : d.pct + '% uptime'}`}
          style={{
            flex: 1, height: 20, borderRadius: 2,
            background:
              d.pct < 0 ? 'var(--bg-elevated)' :
              d.pct === 100 ? '#4ade80' :
              d.pct >= 95 ? '#86efac' :
              d.pct >= 80 ? '#fbbf24' : '#f87171',
            opacity: d.pct < 0 ? 0.3 : 1,
          }}
        />
      ))}
    </div>
  )
}

// ─── StatusPage ─────────────────────────────────────────────────────────────────

interface StatusData {
  orgName: string
  pageTitle: string
  endpoints: Endpoint[]
  incidents: Incident[]
}

export function StatusPage() {
  const { slug } = useParams<{ slug: string }>()
  const [data, setData] = useState<StatusData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!slug) return
    try {
      // 1. Resolve org by slug
      const { data: orgRow, error: orgError } = await supabase
        .from('organizations')
        .select('id, name')
        .eq('slug', slug)
        .single()
      
      if (orgError || !orgRow) {
        setError('Status page not found.')
        setLoading(false)
        return
      }

      // 2. Fetch status page config — FIXED: using 'as any'
      const { data: spRow, error: spError } = await supabase
        .from('status_pages' as any)
        .select('title, is_public')
        .eq('organization_id', orgRow.id)
        .eq('is_public', true)
        .single()
      
      if (spError || !spRow) {
        setError('This status page is not public.')
        setLoading(false)
        return
      }

      // 3. Fetch endpoints + incidents in parallel
      const [{ data: eps }, { data: incs }] = await Promise.all([
        supabase
          .from('endpoints_with_status')
          .select('*')
          .eq('organization_id', orgRow.id)
          .order('created_at'),
        supabase
          .from('incidents')
          .select('*, endpoint:endpoints(id, name, url)')
          .eq('organization_id', orgRow.id)
          .order('started_at', { ascending: false })
          .limit(30),
      ])

      // ─── FIXED: Type assertion for spRow ──────────────────────────────────
    const typedSpRow = spRow as unknown as { title: string; is_public: boolean }
      setData({
        orgName: orgRow.name,
        pageTitle: typedSpRow.title ?? 'Status',
        endpoints: (eps ?? []) as Endpoint[],
        incidents: (incs ?? []) as Incident[],
      })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [slug])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)' }}>
        <div className="loading-spinner" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-base)', color: 'var(--text-secondary)' }}>
        {error ?? 'Not found.'}
      </div>
    )
  }

  const openIncidents = data.incidents.filter(i => !i.resolved_at)
  const pastIncidents = data.incidents.filter(i => !!i.resolved_at)
  const allUp = data.endpoints.every(e => e.status === 'up')

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }}>
      {/* ── Header ── */}
      <div style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', padding: '20px 24px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)', marginBottom: 4 }}>{data.orgName}</div>
          <h1 style={{ fontFamily: 'var(--font-head)', fontSize: 22, fontWeight: 700 }}>{data.pageTitle}</h1>
        </div>
      </div>

      {/* ── Banner ── */}
      <div style={{
        background: allUp ? 'rgba(74,222,128,0.08)' : 'rgba(248,113,113,0.08)',
        borderBottom: `1px solid ${allUp ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)'}`,
        padding: '20px 24px',
      }}>
        <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{
            width: 12, height: 12, borderRadius: '50%',
            background: allUp ? 'var(--green)' : 'var(--red)',
            boxShadow: `0 0 8px ${allUp ? 'var(--green)' : 'var(--red)'}`,
            flexShrink: 0,
          }} />
          <span style={{ fontFamily: 'var(--font-head)', fontSize: 18, fontWeight: 700 }}>
            {allUp
              ? 'All Systems Operational'
              : `${openIncidents.length} Active Incident${openIncidents.length !== 1 ? 's' : ''}`}
          </span>
        </div>
      </div>

      <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 24px', display: 'flex', flexDirection: 'column', gap: 40 }}>
        {/* ── Active incidents ── */}
        {openIncidents.length > 0 && (
          <section>
            <SectionTitle>Active Incidents</SectionTitle>
            {openIncidents.map(inc => (
              <div key={inc.id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 16px', background: 'rgba(248,113,113,0.06)',
                border: '1px solid rgba(248,113,113,0.2)', borderRadius: 6, marginBottom: 8,
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--red)', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{inc.endpoint?.name}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 11, marginTop: 2 }}>
                    Started {formatRelativeTime(inc.started_at)} · {inc.status}
                  </div>
                </div>
              </div>
            ))}
          </section>
        )}

        {/* ── Component status ── */}
        <section>
          <SectionTitle>Components</SectionTitle>
          {data.endpoints.map(ep => {
            const s = ep.status ?? 'unknown'
            return (
              <div key={ep.id} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '14px 0', borderBottom: '1px solid var(--border)',
              }}>
                <span style={{
                  width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                  background: statusColor(s), boxShadow: `0 0 5px ${statusColor(s)}`,
                }} />
                <span style={{ fontWeight: 600, fontSize: 13, minWidth: 140 }}>{ep.name}</span>
                <UptimeHeatmap endpointId={ep.id} />
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-secondary)', minWidth: 70, textAlign: 'right' }}>
                  {ep.uptime_24h !== null ? `${ep.uptime_24h}%` : '—'}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 600, color: statusColor(s), minWidth: 68, textAlign: 'right' }}>
                  {s.toUpperCase()}
                </span>
              </div>
            )
          })}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)' }}>← 90 days</span>
          </div>
        </section>

        {/* ── Incident history ── */}
        {pastIncidents.length > 0 && (
          <section>
            <SectionTitle>Past Incidents</SectionTitle>
            {pastIncidents.slice(0, 10).map(inc => (
              <div key={inc.id} style={{
                display: 'flex', alignItems: 'flex-start', gap: 12,
                padding: '14px 0', borderBottom: '1px solid var(--border)',
              }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', marginTop: 4, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{inc.endpoint?.name}</div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: 11, marginTop: 2 }}>
                    {inc.started_at.slice(0, 10)} ·{' '}
                    {inc.resolved_at
                      ? `Resolved in ${formatDuration(new Date(inc.resolved_at).getTime() - new Date(inc.started_at).getTime())}`
                      : 'Duration unknown'}
                  </div>
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--green)', padding: '2px 8px', border: '1px solid rgba(74,222,128,0.3)', borderRadius: 4 }}>RESOLVED</span>
              </div>
            ))}
          </section>
        )}
      </div>

      {/* ── Footer ── */}
      <div style={{ borderTop: '1px solid var(--border)', padding: '20px 24px', textAlign: 'center' }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)' }}>
          Powered by <span style={{ color: 'var(--blue)' }}>ReliabilityOps</span>
        </span>
      </div>
    </div>
  )
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.08em', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: 16 }}>
      {children}
    </h2>
  )
}