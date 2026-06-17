import { useState } from 'react'
import { supabase } from '../lib/supabase.js'

type Mode = 'sign_in' | 'sign_up'

export function Auth() {
  const [mode,     setMode]     = useState<Mode>('sign_in')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [message,  setMessage]  = useState<string | null>(null)

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      if (mode === 'sign_in') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        setMessage('Check your email to confirm your account.')
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg-base)',
    }}>
      <div style={{
        width: 400, background: 'var(--bg-surface)', border: '1px solid var(--border-mid)',
        borderRadius: 'var(--radius-lg)', padding: 32,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <span style={{ color: 'var(--blue)', fontSize: 24 }}>◉</span>
          <div>
            <div style={{ fontFamily: 'var(--font-head)', fontSize: 18, fontWeight: 700 }}>ReliabilityOps</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--text-secondary)' }}>
              {mode === 'sign_in' ? 'SIGN IN TO YOUR WORKSPACE' : 'CREATE AN ACCOUNT'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="field">
            <label className="field__label">Email</label>
            <input className="input" type="email" placeholder="you@company.com"
              value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="field">
            <label className="field__label">Password</label>
            <input className="input" type="password" placeholder="••••••••"
              value={password} onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()} />
          </div>

          {error   && <div style={{ color: 'var(--red)',   fontSize: 12 }}>{error}</div>}
          {message && <div style={{ color: 'var(--green)', fontSize: 12 }}>{message}</div>}

          <button className="btn btn--primary" onClick={handleSubmit} disabled={loading} style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}>
            {loading ? 'Loading…' : mode === 'sign_in' ? 'Sign In' : 'Create Account'}
          </button>

          <button
            style={{ fontSize: 12, color: 'var(--text-secondary)', textAlign: 'center', paddingTop: 4 }}
            onClick={() => { setMode(m => m === 'sign_in' ? 'sign_up' : 'sign_in'); setError(null) }}
          >
            {mode === 'sign_in' ? "Don't have an account? Sign up" : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    </div>
  )
}
