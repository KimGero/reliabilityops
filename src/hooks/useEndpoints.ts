// src/hooks/useEndpoints.ts
import { useEffect, useReducer, useCallback } from 'react'
import { supabase, fetchEndpointsWithStatus } from '../lib/supabase.js'
import type { Endpoint, AddEndpointForm } from '../types/index.js'
import { deriveStatus } from '../lib/utils.js'
import { logAudit } from '../lib/audit.js'

interface State { endpoints: Endpoint[]; loading: boolean; error: string | null }

type Action =
  | { type: 'SET_LOADING' }
  | { type: 'SET_ENDPOINTS'; payload: Endpoint[] }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'ADD_ENDPOINT'; payload: Endpoint }
  | { type: 'REMOVE_ENDPOINT'; payload: string }
  | { type: 'UPDATE_STATUS'; payload: { endpoint_id: string; is_up: boolean; response_time_ms: number | null; checked_at: string } }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_LOADING': return { ...state, loading: true, error: null }
    case 'SET_ENDPOINTS': return { ...state, loading: false, endpoints: action.payload }
    case 'SET_ERROR': return { ...state, loading: false, error: action.payload }
    case 'ADD_ENDPOINT': return { ...state, endpoints: [action.payload, ...state.endpoints] }
    case 'REMOVE_ENDPOINT': return { ...state, endpoints: state.endpoints.filter(e => e.id !== action.payload) }
    case 'UPDATE_STATUS': {
      const { endpoint_id, is_up, response_time_ms, checked_at } = action.payload
      return {
        ...state,
        endpoints: state.endpoints.map(e =>
          e.id === endpoint_id
            ? { ...e, status: deriveStatus(is_up, response_time_ms), last_response_time_ms: response_time_ms, last_checked_at: checked_at }
            : e
        ),
      }
    }
    default: return state
  }
}

export function useEndpoints() {
  const [state, dispatch] = useReducer(reducer, { endpoints: [], loading: true, error: null })

  const load = useCallback(async () => {
    dispatch({ type: 'SET_LOADING' })
    try {
      const data = await fetchEndpointsWithStatus()
      dispatch({ type: 'SET_ENDPOINTS', payload: data as Endpoint[] })
    } catch (err) {
      dispatch({ type: 'SET_ERROR', payload: (err as Error).message })
    }
  }, [])

  useEffect(() => {
    load()

    // ─── REALTIME DISABLED (temporarily) ────────────────────────────
    // Uncomment this when you upgrade @supabase/supabase-js
    /*
    const ch = supabase.channel('endpoint-status')
    ch.on('postgres_changes' as any,
      { event: 'INSERT', schema: 'public', table: 'checks' },
      (payload: any) => {
        const c = payload.new as { endpoint_id: string; is_up: boolean; response_time_ms: number | null; checked_at: string }
        dispatch({ type: 'UPDATE_STATUS', payload: c })
      }
    )
    ch.subscribe()
    return () => { supabase.removeChannel(ch) }
    */
  }, [load])

  const addEndpoint = useCallback(async (form: AddEndpointForm): Promise<void> => {
    const { data, error } = await supabase
      .from('endpoints')
      .insert({
        name: form.name,
        url: form.url,
        method: form.method,
        interval_seconds: form.interval_seconds,
        expected_status: form.expected_status,
        timeout_ms: form.timeout_ms,
        slo_target: form.slo_target,
      })
      .select()
      .single()
    if (error) throw error
    dispatch({ type: 'ADD_ENDPOINT', payload: { ...(data as Endpoint), status: 'unknown' } })
    await logAudit({
      action: 'endpoint.created',
      resourceType: 'endpoint',
      resourceId: (data as Endpoint).id,
      resourceName: form.name
    })
  }, [])

  const removeEndpoint = useCallback(async (id: string): Promise<void> => {
    const ep = state.endpoints.find(e => e.id === id)
    const { error } = await supabase.from('endpoints').delete().eq('id', id)
    if (error) throw error
    dispatch({ type: 'REMOVE_ENDPOINT', payload: id })
    await logAudit({
      action: 'endpoint.deleted',
      resourceType: 'endpoint',
      resourceId: id,
      resourceName: ep?.name
    })
  }, [state.endpoints])

  return {
    endpoints: state.endpoints,
    loading: state.loading,
    error: state.error,
    reload: load,
    addEndpoint,
    removeEndpoint,
  }
}