import { Database as SupabaseDatabase } from './supabase.js'

export type Database = SupabaseDatabase

export type HttpMethod      = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD'
export type EndpointStatus  = 'up' | 'down' | 'degraded' | 'unknown'
export type IncidentStatus  = 'Investigating' | 'Degraded' | 'Major Outage' | 'Resolved'
export type AlertChannel    = 'slack' | 'email' | 'none'
export type OrgRole         = 'owner' | 'admin' | 'viewer'

//  Domain Models

export interface Endpoint {
  id: string
  name: string
  url: string
  method: HttpMethod
  interval_seconds: number
  expected_status: number
  timeout_ms: number
  slo_target: number
  consecutive_failures: number
  last_failure_at: string | null
  organization_id: string | null
  created_by: string | null
  created_at: string
  updated_at: string
  // Computed from latest check
  status?: EndpointStatus
  last_response_time_ms?: number | null
  last_checked_at?: string | null
  uptime_24h?: number | null
}

export interface Check {
  id: string
  endpoint_id: string
  status_code: number | null
  response_time_ms: number | null
  is_up: boolean
  error_message: string | null
  checked_at: string
}

export interface Incident {
  id: string
  endpoint_id: string
  status: IncidentStatus
  started_at: string
  resolved_at: string | null
  acknowledged_by: string | null
  acknowledged_at: string | null
  organization_id: string | null
  // Joined
  endpoint?: Pick<Endpoint, 'id' | 'name' | 'url'>
}

export interface AlertConfig {
  id: string
  endpoint_id: string
  channel: AlertChannel
  destination: string
  notify_on_down: boolean
  notify_on_recovery: boolean
  created_at: string
}

export interface Organization {
  id: string
  name: string
  slug: string
  created_at: string
}

export interface OrganizationUser {
  organization_id: string
  user_id: string
  role: OrgRole
  joined_at: string
}

export interface AuditLogEntry {
  id: string
  organization_id: string | null
  user_id: string | null
  user_email: string | null
  action: string
  resource_type: string
  resource_id: string | null
  resource_name: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

// UI Types

export interface PresenceUser {
  user_id: string
  user_name: string
  online_at: string
}

export interface CheckHistory {
  checked_at: string
  response_time_ms: number | null
  is_up: boolean
  status_code: number | null
}

export interface EndpointStats {
  uptime_percentage: number
  avg_response_time_ms: number
  p95_response_time_ms: number
  total_checks: number
}

// Form Types 

export interface AddEndpointForm {
  name: string
  url: string
  method: HttpMethod
  interval_seconds: number
  expected_status: number
  timeout_ms: number
  slo_target: number
}

// Cron

export interface CronJobResult {
  checked: number
  failed: number
  incidents_created: number
  incidents_resolved: number
  duration_ms: number
}