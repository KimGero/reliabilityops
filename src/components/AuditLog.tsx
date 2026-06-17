// src/components/AuditLog.tsx
import { useAuditLog } from '../hooks/useAuditLog.js'  // ← Add .js
import { formatRelativeTime } from '../lib/utils.js'  // ← Add .js
import type { AuditLogEntry } from '../types/index.js'  // ← Add .js

const ACTION_META: Record<string, { symbol: string; color: string }> = {
  'endpoint.created':      { symbol: '+', color: '#4ade80' },
  'endpoint.deleted':      { symbol: '✕', color: '#f87171' },
  'incident.acknowledged': { symbol: '◎', color: '#fbbf24' },
  'incident.resolved':     { symbol: '✓', color: '#4ade80' },
  'incident.escalated':    { symbol: '▲', color: '#fb923c' },
  'slo.updated':           { symbol: '~', color: '#60a5fa' },
}

export function AuditLog() {
  const { entries } = useAuditLog(20)

  return (
    <div className="audit-log">
      <div className="section-title">ACTIVITY LOG</div>
      {entries.length === 0 && (
        <div style={{ padding: '16px 12px', color: '#566577', fontSize: 11 }}>No activity yet.</div>
      )}
      {entries.map((e: AuditLogEntry) => {  // ← Fixed: explicit type
        const meta = ACTION_META[e.action] ?? { symbol: '·', color: '#475569' }
        return (
          <div key={e.id} className="audit-row">
            <span style={{ color: meta.color, fontFamily: 'monospace', fontSize: 12, flexShrink: 0 }}>{meta.symbol}</span>
            <div className="audit-row__body">
              <span className="audit-action">{e.action}</span>
              {e.resource_name && <span className="audit-resource">{e.resource_name}</span>}
            </div>
            <span className="audit-time">{formatRelativeTime(e.created_at)}</span>
          </div>
        )
      })}
    </div>
  )
}