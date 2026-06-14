import { createClient } from '@supabase/supabase-js'
import type { Database, CronJobResult } from '@/types/index.ts'
import { sendSlackAlert, sendEmailAlert } from '@/lib/alerts.js'

export const dynamic = 'force-dynamic'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)

const SLACK_WEBHOOK = process.env.SLACK_WEBHOOK_URL
const RESEND_API_KEY = process.env.RESEND_API_KEY
const ALERT_EMAILS = process.env.ALERT_EMAILS?.split(',').map(e => e.trim()) || []

export async function GET(request: Request) {
  // Auth check
  const authHeader = request.headers.get('authorization')
  const expectedToken = `Bearer ${process.env.CRON_SECRET}`

  if (authHeader !== expectedToken) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: CronJobResult[] = []
  let checked = 0
  let down = 0

  try {
    const { data: endpoints, error } = await supabase
      .from('endpoints')
      .select('*')
      .eq('is_active', true)

    if (error) throw error
    if (!endpoints || endpoints.length === 0) {
      return Response.json({ success: true, checked: 0, down: 0, message: 'No active endpoints found' })
    }

    for (const endpoint of endpoints) {
      checked++
      const start = Date.now()

      try {
        const res = await fetch(endpoint.url, { 
          method: 'HEAD', 
          cache: 'no-store',
          signal: AbortSignal.timeout(10000) 
        })

        const responseTime = Date.now() - start
        const isUp = res.ok

        if (!isUp) {
          down++
          const payload = {
            endpointName: endpoint.name,
            endpointUrl: endpoint.url,
            statusCode: res.status,
            responseTime,
            isRecovery: false
          } as const

          if (SLACK_WEBHOOK) await sendSlackAlert(SLACK_WEBHOOK, payload)
          if (RESEND_API_KEY && ALERT_EMAILS.length > 0) {
            await sendEmailAlert(RESEND_API_KEY, ALERT_EMAILS, payload)
          }
        }

      } catch (err: any) {
        down++
        const payload = {
          endpointName: endpoint.name,
          endpointUrl: endpoint.url,
          error: err.message || 'Unknown error',
          isRecovery: false
        } as const

        if (SLACK_WEBHOOK) await sendSlackAlert(SLACK_WEBHOOK, payload)
        if (RESEND_API_KEY && ALERT_EMAILS.length > 0) {
          await sendEmailAlert(RESEND_API_KEY, ALERT_EMAILS, payload)
        }
      }
    }

    const result: CronJobResult = {
      success: true,
      message: `Checked ${checked} endpoints, ${down} down`,
      checked,
      down
    }

    results.push(result)

    return Response.json({ 
      success: true, 
      checked, 
      down, 
      message: result.message 
    })

  } catch (error: any) {
    console.error('Cron job failed:', error)
    return Response.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 })
  }
}