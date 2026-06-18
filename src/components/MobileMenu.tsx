
import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Menu, X, LayoutDashboard, BarChart2, ExternalLink } from 'lucide-react'

interface NavItem {
  path: string
  label: string
  icon: React.ReactNode
}

const navItems: NavItem[] = [
  { path: '/', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { path: '/exec', label: 'Analytics', icon: <BarChart2 size={18} /> },
]

export function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  const handleNavigate = (path: string) => {
    navigate(path)
    setIsOpen(false)
  }

  const toggleMenu = () => setIsOpen(!isOpen)

  return (
    <>
      {/* ─── Toggle Button ──────────────────────────────────────────────────── */}
      <button 
        className="mobile-menu-toggle" 
        onClick={toggleMenu}
        aria-label="Toggle menu"
      >
        <Menu size={22} />
      </button>

      {/* ─── Overlay ────────────────────────────────────────────────────────── */}
      <div 
        className={`mobile-menu-overlay${isOpen ? ' open' : ''}`}
        onClick={() => setIsOpen(false)}
      />

      {/* ─── Panel ──────────────────────────────────────────────────────────── */}
      <div className={`mobile-menu-panel${isOpen ? ' open' : ''}`}>
        <div className="mobile-menu-header">
          <span className="brand-name">ReliabilityOps</span>
          <button className="mobile-menu-close" onClick={() => setIsOpen(false)}>
            <X size={20} />
          </button>
        </div>

        {navItems.map((item) => {
          const isActive = location.pathname === item.path
          return (
            <button
              key={item.path}
              className={`mobile-menu-link${isActive ? ' active' : ''}`}
              onClick={() => handleNavigate(item.path)}
            >
              <span className="icon">{item.icon}</span>
              {item.label}
              {isActive && <span style={{ marginLeft: 'auto', color: 'var(--blue)', fontSize: '10px' }}>●</span>}
            </button>
          )
        })}

        <div style={{ 
          marginTop: 'auto', 
          paddingTop: '16px', 
          borderTop: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <a 
            href="https://github.com/KimGero/reliabilityops" 
            target="_blank" 
            rel="noopener noreferrer"
            className="mobile-menu-link"
            style={{ fontSize: '11px', color: 'var(--text-muted)' }}
          >
            <ExternalLink size={16} />
            GitHub
          </a>
        </div>
      </div>
    </>
  )
}