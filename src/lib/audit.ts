// src/lib/audit.ts
import { supabase } from './supabase.js'

export type AuditAction =
  | 'endpoint.created'
  | 'endpoint.deleted'
  | 'incident.acknowledged'
  | 'incident.resolved'
  | 'incident.escalated'
  | 'slo.updated'
  | 'alert.created'
  | 'alert.deleted'

interface AuditParams {
  action: AuditAction
  resourceType: string
  resourceId?: string
  resourceName?: string
  metadata?: Record<string, unknown>
}

export async function logAudit(params: AuditParams): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    // Use type assertion to bypass the type check
    await supabase
      .from('audit_logs' as any)
      .insert({
        user_id: user?.id ?? null,
        user_email: user?.email ?? 'anonymous',
        action: params.action,
        resource_type: params.resourceType,
        resource_id: params.resourceId,
        resource_name: params.resourceName,
        metadata: params.metadata ?? {},
      })
  } catch {
    // Audit logging must never crash the app
    console.warn('[audit] failed to log:', params.action)
  }
}