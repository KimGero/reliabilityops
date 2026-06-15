import { createClient } from '@supabase/supabase-js'
import type { Database, CronJobResult } from '../../src/types/index.js'
import { sendSlackAlert, sendEmailAlert } from '../../src/lib/alerts.js'

export const config = { runtime: 'edge' }
export const preferredRegion = 'auto'

const FAILURE_THRESHOLD = 3

function isCronRequest(req: Request): boolean {
  return req.headers.get('authorization') === `Bearer ${process.env.CRON_SECRET}`
}

interface CheckResult {
  endpoint_id: string
  is_up: boolean
  status_code: number | null
  response_time_ms: number | null
  error_message: string | null
}

async function checkEndpoint(
  url: string, method: string, expectedStatus: number,
  timeoutMs: number, endpointId: string, maxAttempts = 2
): Promise<CheckResult> {
  let lastError: string | null = null
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 1000 * attempt))
    const start = Date.now()
    try {
      const res = await fetch(url, {
        method, signal: AbortSignal.timeout(timeoutMs), redirect: 'follow',
        headers: { 'User-Agent': 'ReliabilityOps/1.0' },
      })
      const rt = Date.now() - start
      const isUp = res.status === expectedStatus
      return {
        endpoint_id: endpointId, is_up: isUp,
        status_code: res.status, response_time_ms: rt,
        error_message: isUp ? null : `Status ${res.status} (expected ${expectedStatus})`,
      }
    } catch (err) { lastError = (err as Error).message }
  }
  return { endpoint_id: endpointId, is_up: false, status_code: null, response_time_ms: null, error_message: lastError }
}

async function getOpenIncident(sb: ReturnType<typeof createClient<Database>>, endpointId: string) {
  const { data } = await sb
    .from('incidents').select('id, started_at, status')
    .eq('endpoint_id', endpointId).is('resolved_at', null)
    .order('started_at', { ascending: false }).limit(1).maybeSingle()
  return data
}

async function sendAlerts(
  sb: ReturnType<typeof createClient<Database>>,
  ep: { id: string; name: string; url: string },
  check: CheckResult, isRecovery: boolean
) {
  const { data: configs } = await sb.from('alert_configs').select('*')
    .eq('endpoint_id', ep.id)
    .eq(isRecovery ? 'notify_on_recovery' : 'notify_on_down', true)
  if (!configs?.length) return
  const payload = {
    endpointName: ep.name, endpointUrl: ep.url,
    error: check.error_message ?? undefined,
    responseTime: check.response_time_ms ?? undefined,
    statusCode: check.status_code ?? undefined,
    isRecovery,
  }
  await Promise.allSettled(configs.map(cfg => {
    if (cfg.channel === 'slack') return sendSlackAlert(cfg.destination, payload)
    if (cfg.channel === 'email') return sendEmailAlert(process.env.RESEND_API_KEY!, [cfg.destination], payload)
    return Promise.resolve()
  }))
}

export default async function handler(req: Request): Promise<Response> {
  if (!isCronRequest(req)) return new Response('Unauthorized', { status: 401 })

  const t0 = Date.now()
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    return new Response(JSON.stringify({ error: 'Missing Supabase credentials' }), { status: 500 })
  }

  const sb = createClient<Database>(supabaseUrl, supabaseKey)
  const result: CronJobResult = { checked: 0, failed: 0, incidents_created: 0, incidents_resolved: 0, duration_ms: 0 }

  const { data: endpoints, error } = await sb.from('endpoints').select('*').order('created_at')
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  if (!endpoints?.length) return new Response(JSON.stringify({ message: 'No endpoints', ...result }))

  const CONCURRENCY = 10
for (let i = 0; i < endpoints.length; i += CONCURRENCY) {
  await Promise.allSettled(
    endpoints.slice(i, i + CONCURRENCY).map(async ep => {
      const check = await checkEndpoint(
        ep.url, 
        ep.method ?? 'GET',        
        ep.expected_status ?? 200, 
        ep.timeout_ms ?? 5000,     
        ep.id
      )
      result.checked++
      if (!check.is_up) result.failed++

        await sb.from('checks').insert({
          endpoint_id: check.endpoint_id, is_up: check.is_up,
          status_code: check.status_code, response_time_ms: check.response_time_ms,
          error_message: check.error_message,
        })

        const openIncident = await getOpenIncident(sb, ep.id)
        const prevFails = ep.consecutive_failures ?? 0

        if (!check.is_up) {
          const newCount = prevFails + 1
          await sb.from('endpoints')
            .update({ consecutive_failures: newCount, last_failure_at: new Date().toISOString() })
            .eq('id', ep.id)

          if (newCount >= FAILURE_THRESHOLD && !openIncident) {
            await sb.from('incidents').insert({ endpoint_id: ep.id, status: 'Investigating' })
            result.incidents_created++
            await sendAlerts(sb, ep, check, false)
          }
        } else {
          if (prevFails > 0) {
            await sb.from('endpoints')
              .update({ consecutive_failures: 0, last_failure_at: null })
              .eq('id', ep.id)
          }

          if (openIncident) {
            await sb.from('incidents')
              .update({ resolved_at: new Date().toISOString(), status: 'Resolved' })
              .eq('id', openIncident.id)
            result.incidents_resolved++
            await sendAlerts(sb, ep, check, true)
          }
        }
      })
    )
  }

  result.duration_ms = Date.now() - t0
  console.info('[Cron]', result)
  return new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json' } })
}
