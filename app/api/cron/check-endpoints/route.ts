import { createClient } from '@supabase/supabase-js'
import type { Database, CronJobResult } from '@/types/index'
import { sendSlackAlert, sendEmailAlert } from '@/lib/alerts'

export const dynamic = 'force-dynamic'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SLACK_WEBHOOK = process.env.SLACK_WEBHOOK_URL
const RESEND_API_KEY = process.env.RESEND_API_KEY
const ALERT_EMAILS = process.env.ALERT_EMAILS?.split(',').map(e => e.trim()) || []

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const expectedToken = `Bearer ${process.env.CRON_SECRET}`

  if (authHeader !== expectedToken) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let checked = 0
  let down = 0

  try {
    const { data: endpoints, error } = await supabase
      .from('endpoints')
      .select('*')
      .eq('is_active', true)

    if (error) throw error

    if (!endpoints?.length) {
      return Response.json({
        success: true,
        message: 'No active endpoints found',
        checked: 0,
        down: 0
      })
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

        if (!res.ok) {
          down++
          const payload = {
            endpointName: endpoint.name,
            endpointUrl: endpoint.url,
            statusCode: res.status,
            responseTime,
            isRecovery: false
          }

          if (SLACK_WEBHOOK) await sendSlackAlert(SLACK_WEBHOOK, payload)
          if (RESEND_API_KEY && ALERT_EMAILS.length) {
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
        }

        if (SLACK_WEBHOOK) await sendSlackAlert(SLACK_WEBHOOK, payload)
        if (RESEND_API_KEY && ALERT_EMAILS.length) {
          await sendEmailAlert(RESEND_API_KEY, ALERT_EMAILS, payload)
        }
      }
    }

    return Response.json({
      success: true,
      message: `Checked ${checked} endpoints, ${down} down`,
      checked,
      down
    })

  } catch (error: any) {
    console.error('Cron failed:', error)
    return Response.json({
      success: false,
      message: error.message || 'Internal server error',
      checked: 0,
      down: 0
    }, { status: 500 })
  }
}