// src/App.tsx
import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase.js'
import type { Session } from '@supabase/supabase-js'
import { Dashboard } from './components/Dashboard.js'
import { Auth } from './pages/Auth.js'
import { StatusPage } from './pages/StatusPage.js'  
import { ExecDashboard } from './pages/ExecDashboard.js'  

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  
  if (session === undefined) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        background: 'var(--bg-base)' 
      }}>
        <div className="loading-spinner" />
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* ─── PUBLIC ROUTES (no auth required) ────────────────────────────── */}
        <Route path="/status/:slug" element={<StatusPage />} />

        {/* ─── AUTH ROUTES ──────────────────────────────────────────────────── */}
        {!session ? (
          <>
            <Route path="/auth" element={<Auth />} />
            <Route path="*" element={<Navigate to="/auth" replace />} />
          </>
        ) : (
          <>
            <Route path="/" element={<Dashboard />} />
            <Route path="/exec" element={<ExecDashboard />} />  {/* ← OPTIONAL */}
            <Route path="/auth" element={<Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </>
        )}
      </Routes>
    </BrowserRouter>
  )
}
