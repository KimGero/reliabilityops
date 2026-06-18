// src/components/Dashboard.tsx
import { useState } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { Plus, RefreshCw, Wifi, WifiOff, BarChart2 } from "lucide-react"
import { useEndpoints } from '../hooks/useEndpoints.js'  
import { useIncidents } from '../hooks/useIncidents.js'  
import { EndpointCard } from './EndpointCard.js'  
import { AddEndpointModal } from './AddEndpointModal.js'  
import { StatsBar } from './StatsBar.js'  
import { TeamFeed } from './TeamFeed.js' 
import { TopBar } from './TopBar.js' 
import type { Endpoint } from '../types/index.js'  

// ─── NavLink Component ──────────────────────────────────────────────────────
function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const active = pathname === to
  return (
    <button className={`nav-link${active ? ' nav-link--active' : ''}`} onClick={() => navigate(to)}>
      {children}
    </button>
  )
}

export function Dashboard() {
  const { endpoints, loading, error, reload, addEndpoint, removeEndpoint } = useEndpoints()
  const { incidents, openIncidents } = useIncidents()
  const [showModal, setShowModal] = useState(false)
  const [showTeam, setShowTeam] = useState(true)
  const [reloading, setReloading] = useState(false)
  const [liveMode, setLiveMode] = useState(true)

  const handleReload = async () => {
    setReloading(true)
    await reload()
    setReloading(false)
  }

  return (
    <div className="dashboard">
      {/* ─── TopBar ────────────────────────────────────────────────────── */}
      <TopBar title="v1.0" />

      {/* ─── Controls ──────────────────────────────────────────────────── */}
      <div className="topbar__controls" style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '6px',
        padding: '0 20px',
        height: '48px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-surface)',
      }}>
        <button className={`control-btn${liveMode ? ' control-btn--active' : ''}`} onClick={() => setLiveMode(l => !l)}>
          {liveMode ? <Wifi size={13} /> : <WifiOff size={13} />}
          {liveMode ? 'LIVE' : 'PAUSED'}
        </button>
        <button className="control-btn" onClick={handleReload} disabled={reloading}>
          <RefreshCw size={13} className={reloading ? 'spin' : ''} /> REFRESH
        </button>
        <button className={`control-btn${showTeam ? ' control-btn--active' : ''}`} onClick={() => setShowTeam(t => !t)}>
          TEAM FEED
          {openIncidents.length > 0 && <span className="control-badge">{openIncidents.length}</span>}
        </button>
        <button className="control-btn control-btn--add" onClick={() => setShowModal(true)}>
          <Plus size={13} /> ADD ENDPOINT
        </button>
      </div>

      <StatsBar endpoints={endpoints} incidents={incidents} incidentCount={openIncidents.length} />

      <main className="main-area">
        <section className={`endpoint-section${showTeam ? ' endpoint-section--with-sidebar' : ''}`}>
          {loading && <div className="loading-state"><div className="loading-spinner" /><span>Loading…</span></div>}
          {error && <div className="error-state"><span>Error: {error}</span><button className="btn btn--ghost btn--sm" onClick={handleReload}>Retry</button></div>}
          {!loading && !error && endpoints.length === 0 && (
            <div className="empty-state">
              <div className="empty-state__icon">◎</div>
              <h2 className="empty-state__title">No endpoints yet</h2>
              <p className="empty-state__body">Add your first endpoint to start monitoring.</p>
              <button className="btn btn--primary" onClick={() => setShowModal(true)}><Plus size={14} /> Add Endpoint</button>
            </div>
          )}
          {!loading && endpoints.length > 0 && (
            <div className="endpoint-grid">
              {endpoints.map((ep: Endpoint) => (
                <EndpointCard key={ep.id} endpoint={ep} incidents={incidents} onDelete={removeEndpoint} />
              ))}
            </div>
          )}
        </section>
        {showTeam && <TeamFeed />}
      </main>

      {showModal && <AddEndpointModal onAdd={addEndpoint} onClose={() => setShowModal(false)} />}
    </div>
  )
}