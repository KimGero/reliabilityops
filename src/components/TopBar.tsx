// src/components/TopBar.tsx
import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { MobileMenu } from './MobileMenu.js'  // ← ADD THIS

interface Props {
  title?: string
  showBack?: boolean
  backTo?: string
}

export function TopBar({ title = 'v1.0', showBack = false, backTo = '/' }: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const isActive = (path: string) => location.pathname === path

  return (
    <header className="topbar">
      {/* ─── Brand ──────────────────────────────────────────────────────── */}
      <div className="topbar__brand">
        <span className="brand-logo">◉</span>
        <span className="brand-name">ReliabilityOps</span>
        <span className="brand-tag">{title}</span>
      </div>

      {/* ─── Desktop Navigation ────────────────────────────────────────── */}
      <nav className="topbar__nav">
        {showBack ? (
          <button 
            className="nav-link" 
            onClick={() => navigate(backTo)}
          >
            <ArrowLeft size={13} /> BACK
          </button>
        ) : (
          <>
            <button 
              className={`nav-link${isActive('/') ? ' nav-link--active' : ''}`}
              onClick={() => navigate('/')}
            >
              MONITOR
            </button>
            <button 
              className={`nav-link${isActive('/exec') ? ' nav-link--active' : ''}`}
              onClick={() => navigate('/exec')}
            >
              ANALYTICS
            </button>
          </>
        )}
      </nav>

      {/* ─── Mobile Menu ────────────────────────────────────────────────── */}
      <div className="topbar__controls" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <MobileMenu />
      </div>
    </header>
  )
}