// ─── Fix imports ─────────────────────────────────────────────
import { useEffect, useReducer, useCallback } from 'react'
import { supabase, fetchRecentIncidents } from '../lib/supabase.js'
import type { Incident, IncidentStatus } from '../types/index.js'
import { getLocalUserName } from '../lib/utils.js'
import { logAudit } from '../lib/audit.js'

interface State { incidents: Incident[]; loading: boolean }

type Action =
  | { type: 'SET_INCIDENTS'; payload: Incident[] }
  | { type: 'UPSERT_INCIDENT'; payload: Incident }
  | { type: 'SET_LOADING'; payload: boolean }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'SET_LOADING':   return { ...state, loading: action.payload }
    case 'SET_INCIDENTS': return { ...state, incidents: action.payload, loading: false }
    case 'UPSERT_INCIDENT': {
      const exists = state.incidents.some(i => i.id === action.payload.id)
      if (exists) return { ...state, incidents: state.incidents.map(i => i.id === action.payload.id ? { ...i, ...action.payload } : i) }
      return { ...state, incidents: [action.payload, ...state.incidents].slice(0, 50) }
    }
    default: return state
  }
}

export function useIncidents() {
  const [state, dispatch] = useReducer(reducer, { incidents: [], loading: true })

  const load = useCallback(async () => {
    dispatch({ type: 'SET_LOADING', payload: true })
    const data = await fetchRecentIncidents()
    dispatch({ type: 'SET_INCIDENTS', payload: data as Incident[] })
  }, [])

  useEffect(() => {
    load()

    const ch = supabase
      .channel('incidents-feed')
      .on('postgres_changes' as any, { event: '*', schema: 'public', table: 'incidents' }, async ({ new: n }: { new: Incident }) => {
        const id = (n as Incident).id
        const { data } = await supabase
          .from('incidents').select('*, endpoint:endpoints(id, name, url)').eq('id', id).single()
        if (data) dispatch({ type: 'UPSERT_INCIDENT', payload: data as Incident })
      })
      .subscribe()

    return () => { supabase.removeChannel(ch) }
  }, [load])

  const acknowledge = useCallback(async (id: string): Promise<void> => {
    const { error } = await supabase.from('incidents').update({
      acknowledged_by: getLocalUserName(),
      acknowledged_at: new Date().toISOString(),
    }).eq('id', id)
    if (error) throw error
    await logAudit({ action: 'incident.acknowledged', resourceType: 'incident', resourceId: id })
  }, [])

  const escalate = useCallback(async (id: string, status: IncidentStatus): Promise<void> => {
    const { error } = await supabase.from('incidents').update({ status }).eq('id', id)
    if (error) throw error
    await logAudit({ action: 'incident.escalated', resourceType: 'incident', resourceId: id, metadata: { status } })
  }, [])

  const resolveIncident = useCallback(async (id: string): Promise<void> => {
    const { error } = await supabase.from('incidents').update({
      resolved_at: new Date().toISOString(), status: 'Resolved',
    }).eq('id', id)
    if (error) throw error
    await logAudit({ action: 'incident.resolved', resourceType: 'incident', resourceId: id })
  }, [])

  return {
    incidents: state.incidents,
    openIncidents: state.incidents.filter(i => !i.resolved_at),
    closedIncidents: state.incidents.filter(i => !!i.resolved_at),
    loading: state.loading,
    load,
    acknowledge,
    escalate,
    resolveIncident,
  }
}