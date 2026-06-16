// src/components/TeamFeed.tsx
import { AlertTriangle, CheckCircle, Clock, Users, Bell, BellOff } from "lucide-react"
import { useIncidents } from '../hooks/useIncidents.js'  // ← Add .js
import { usePresence } from '../hooks/usePresence.js'  // ← Add .js
import { formatRelativeTime, incidentStatusColor } from '../lib/utils.js'  // ← Add .js
import type { Incident, IncidentStatus } from '../types/index.js'  // ← Add .js

export function TeamFeed() {
  const { incidents, openIncidents, acknowledge, escalate, resolveIncident } = useIncidents()
  const { onlineUsers, userName, updateName } = usePresence()

  return (
    <aside className="team-feed">
      <div className="presence-bar">
        <Users size={12} style={{ opacity: 0.5 }} />
        <span className="presence-label">{onlineUsers.length} online</span>
        <div className="presence-avatars">
          {onlineUsers.slice(0, 5).map((u: { user_id: string; user_name: string; online_at: string }) => (  // ← Fixed: explicit type
            <span key={u.user_id} className="presence-avatar" title={`${u.user_name} — ${formatRelativeTime(u.online_at)}`}>
              {u.user_name[0]?.toUpperCase() ?? '?'}
            </span>
          ))}
        </div>
        <button className="presence-name-btn" onClick={() => { const n = prompt('Your name', userName); if (n) updateName(n) }}>
          you: <strong>{userName}</strong>
        </button>
      </div>

      <div className="feed-header">
        <div className="feed-title">
          {openIncidents.length > 0 ? <Bell size={13} style={{ color: '#f87171' }} /> : <BellOff size={13} style={{ opacity: 0.3 }} />}
          <span>Incidents</span>
          {openIncidents.length > 0 && <span className="incident-badge">{openIncidents.length}</span>}
        </div>
      </div>

      <div className="incident-list">
        {incidents.length === 0 && (
          <div className="empty-feed">
            <CheckCircle size={20} style={{ opacity: 0.2 }} />
            <span>No incidents in the last 48h</span>
          </div>
        )}
        {incidents.map((inc: Incident) => (  // ← Fixed: explicit type
          <IncidentRow key={inc.id} incident={inc} onAck={acknowledge} onEscalate={escalate} onResolve={resolveIncident} />
        ))}
      </div>
    </aside>
  )
}

function IncidentRow({ incident, onAck, onEscalate, onResolve }: {
  incident: Incident
  onAck: (id: string) => void
  onEscalate: (id: string, s: IncidentStatus) => void
  onResolve: (id: string) => void
}) {
  const isOpen = !incident.resolved_at
  const statusColor = incidentStatusColor(incident.status)

  return (
    <div className={`incident-row${isOpen ? ' incident-row--open' : ' incident-row--closed'}`}>
      <div className="incident-row__icon">
        {isOpen
          ? <AlertTriangle size={12} style={{ color: '#f87171' }} />
          : <CheckCircle size={12} style={{ color: '#4ade80', opacity: 0.5 }} />}
      </div>
      <div className="incident-row__body">
        <div className="incident-endpoint">{incident.endpoint?.name ?? 'Unknown'}</div>
        <div className="incident-time">
          <Clock size={10} />
          {formatRelativeTime(incident.started_at)}
          {incident.resolved_at && <span className="incident-resolved"> · resolved {formatRelativeTime(incident.resolved_at)}</span>}
        </div>
        <span className="incident-status-badge" style={{ color: statusColor }}>{incident.status.toUpperCase()}</span>
        {incident.acknowledged_by && <div className="incident-ack">✓ {incident.acknowledged_by}</div>}
        {isOpen && (
          <div className="incident-actions">
            {!incident.acknowledged_by && (
              <button className="incident-btn" onClick={() => onAck(incident.id)}>ACK</button>
            )}
            <select className="incident-btn" style={{ cursor: 'pointer' }} value={incident.status} onChange={e => onEscalate(incident.id, e.target.value as IncidentStatus)}>
              <option value="Investigating">Investigating</option>
              <option value="Degraded">Degraded</option>
              <option value="Major Outage">Major Outage</option>
            </select>
            <button className="incident-btn incident-btn--resolve" onClick={() => onResolve(incident.id)}>RESOLVE</button>
          </div>
        )}
      </div>
    </div>
  )
}

