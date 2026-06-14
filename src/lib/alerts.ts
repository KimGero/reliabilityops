// Server-side only — imported by the cron, never by browser bundles

interface AlertPayload {
  endpointName: string
  endpointUrl: string
  error?: string
  responseTime?: number
  statusCode?: number
  isRecovery: boolean
}

// ── Slack ──────────────────────────────────────────────────────────────────────

export async function sendSlackAlert(webhookUrl: string, payload: AlertPayload): Promise<void> {
  const { endpointName, endpointUrl, error, responseTime, statusCode, isRecovery } = payload
  const emoji = isRecovery ? '🟢' : '🔴'
  const title = isRecovery
    ? `${emoji} *${endpointName}* is back UP`
    : `${emoji} *${endpointName}* is DOWN`

  const fields = [
    { type: 'mrkdwn', text: `*URL:*\n${endpointUrl}` },
    { type: 'mrkdwn', text: `*Time:*\n${new Date().toUTCString()}` },
    ...(statusCode   ? [{ type: 'mrkdwn', text: `*Status:*\n${statusCode}` }]     : []),
    ...(responseTime ? [{ type: 'mrkdwn', text: `*Response:*\n${responseTime}ms` }] : []),
    ...(error        ? [{ type: 'mrkdwn', text: `*Error:*\n\`${error}\`` }]        : []),
  ]

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text: title,
      blocks: [{ type: 'section', text: { type: 'mrkdwn', text: title }, fields }, { type: 'divider' }],
    }),
  })
  if (!res.ok) console.error('[Slack] alert failed:', res.status, await res.text())
}

// ── Email via Resend ────────────────────────────────────────────────────────────

export async function sendEmailAlert(apiKey: string, to: string[], payload: AlertPayload): Promise<void> {
  const { endpointName, endpointUrl, error, isRecovery } = payload
  const subject = isRecovery
    ? `✅ [ReliabilityOps] ${endpointName} recovered`
    : `🚨 [ReliabilityOps] ${endpointName} is DOWN`

  const html = `
    <div style="font-family:monospace;max-width:600px;padding:24px;background:#0f1420;color:#e2e8f0;border-radius:8px;">
      <h2 style="color:${isRecovery ? '#4ade80' : '#f87171'};margin:0 0 16px;">${subject}</h2>
      <p>Endpoint: ${endpointName}</p>
      <p>URL: ${endpointUrl}</p>
      <p>Time: ${new Date().toUTCString()}</p>
      ${error ? `<p style="color:#f87171;">Error: ${error}</p>` : ''}
    </div>`

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ from: 'alerts@yourdomain.com', to, subject, html }),
  })
  if (!res.ok) console.error('[Resend] email failed:', res.status, await res.text())
}
