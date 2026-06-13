import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types'

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. Check .env.local.')
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  realtime: { params: { eventsPerSecond: 10 } },
})

// ── Query helpers ──────────────────────────────────────────────────────────────

export async function fetchEndpointsWithStatus() {
  const { data, error } = await supabase
    .from('endpoints_with_status')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function fetchCheckHistory(endpointId: string, limit = 60) {
  const { data, error } = await supabase
    .from('checks')
    .select('checked_at, response_time_ms, is_up, status_code')
    .eq('endpoint_id', endpointId)
    .order('checked_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return (data ?? []).reverse()
}

export async function fetchRecentIncidents(limit = 50) {
  const cutoff = new Date(Date.now() - 48 * 3600_000).toISOString()
  const { data, error } = await supabase
    .from('incidents')
    .select('*, endpoint:endpoints(id, name, url)')
    .gte('started_at', cutoff)
    .order('started_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}