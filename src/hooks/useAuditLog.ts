// src/hooks/useAuditLog.ts
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase.js'
import type { AuditLogEntry } from '../types/index.js'

export function useAuditLog(limit = 30) {
  const [entries, setEntries] = useState<AuditLogEntry[]>([])

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        // Use 'as any' for the entire query to bypass type checking
        const result: any = await supabase
          .from('audit_logs' as any)
          .select('id, created_at, action, resource_type, resource_name, user_email, metadata')
          .order('created_at', { ascending: false })
          .limit(limit)

        if (result.error) {
          console.warn('Failed to fetch audit logs:', result.error)
          setEntries([])
          return
        }

        setEntries((result.data as AuditLogEntry[]) ?? [])
      } catch (error) {
        console.warn('Failed to fetch audit logs:', error)
        setEntries([])
      }
    }

    fetchLogs()
  }, [limit])

  return { entries }
}