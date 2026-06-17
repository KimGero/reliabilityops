import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { AuditLogEntry } from '../types'

export function useAuditLog(limit = 30) {
  const [entries, setEntries] = useState<AuditLogEntry[]>([])

  useEffect(() => {
    supabase
      .from('audit_logs')
      .select('id, created_at, action, resource_type, resource_name, user_email, metadata')
      .order('created_at', { ascending: false })
      .limit(limit)
      .then(({ data }) => setEntries((data as AuditLogEntry[]) ?? []))
  }, [limit])

  return { entries }
}