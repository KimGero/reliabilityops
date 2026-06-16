import { useState } from "react"
import { X, Plus } from "lucide-react"
import { isValidUrl } from '../lib/utils.js'
import type { AddEndpointForm, HttpMethod } from '../types/index.js'

const METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD']
const INTERVALS = [{ label: '30s', value: 30 }, { label: '1m', value: 60 }, { label: '5m', value: 300 }, { label: '15m', value: 900 }]
const DEFAULT: AddEndpointForm = { name: '', url: '', method: 'GET', interval_seconds: 60, expected_status: 200, timeout_ms: 5000, slo_target: 99.9 }

interface Props { onAdd: (form: AddEndpointForm) => Promise<void>; onClose: () => void }

export function AddEndpointModal({ onAdd, onClose }: Props) {
  const [form, setForm]     = useState<AddEndpointForm>(DEFAULT)
  const [errors, setErrors] = useState<Partial<Record<keyof AddEndpointForm, string>>>({})
  const [saving, setSaving] = useState(false)

  const set = <K extends keyof AddEndpointForm>(key: K, val: AddEndpointForm[K]) => {
    setForm(p => ({ ...p, [key]: val }))
    if (errors[key]) setErrors(p => ({ ...p, [key]: undefined }))
  }

  const validate = (): boolean => {
    const e: typeof errors = {}
    if (!form.name.trim())  e.name = 'Name is required'
    if (!form.url.trim())   e.url  = 'URL is required'
    else if (!isValidUrl(form.url)) e.url = 'Must be a valid http/https URL'
    if (form.expected_status < 100 || form.expected_status > 599) e.expected_status = 'Must be 100–599'
    if (form.slo_target < 0 || form.slo_target > 100) e.slo_target = 'Must be 0–100'
    setErrors(e)
    return !Object.keys(e).length
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setSaving(true)
    try { await onAdd(form); onClose() }
    catch (err) { setErrors({ name: (err as Error).message }) }
    finally { setSaving(false) }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal__header">
          <h2 className="modal__title">Add Endpoint</h2>
          <button className="icon-btn" onClick={onClose}><X size={16} /></button>
        </div>
        <div className="modal__body">
          <Field label="Name" error={errors.name}>
            <input className="input" placeholder="Production API" value={form.name} onChange={e => set('name', e.target.value)} autoFocus />
          </Field>
          <Field label="URL" error={errors.url}>
            <input className="input font-mono" placeholder="https://api.example.com/health" value={form.url} onChange={e => set('url', e.target.value)} />
          </Field>
          <div className="field-row">
            <Field label="Method">
              <select className="input" value={form.method} onChange={e => set('method', e.target.value as HttpMethod)}>
                {METHODS.map(m => <option key={m}>{m}</option>)}
              </select>
            </Field>
            <Field label="Interval">
              <select className="input" value={form.interval_seconds} onChange={e => set('interval_seconds', Number(e.target.value))}>
                {INTERVALS.map(i => <option key={i.value} value={i.value}>{i.label}</option>)}
              </select>
            </Field>
          </div>
          <div className="field-row">
            <Field label="Expected Status" error={errors.expected_status}>
              <input className="input font-mono" type="number" min={100} max={599} value={form.expected_status} onChange={e => set('expected_status', Number(e.target.value))} />
            </Field>
            <Field label="Timeout (ms)">
              <input className="input font-mono" type="number" min={500} max={30000} step={500} value={form.timeout_ms} onChange={e => set('timeout_ms', Number(e.target.value))} />
            </Field>
          </div>
          <Field label="SLO Target (%)" error={errors.slo_target}>
            <input className="input font-mono" type="number" min={0} max={100} step={0.1} value={form.slo_target} onChange={e => set('slo_target', Number(e.target.value))} />
          </Field>
        </div>
        <div className="modal__footer">
          <button className="btn btn--ghost" onClick={onClose} disabled={saving}>Cancel</button>
          <button className="btn btn--primary" onClick={handleSubmit} disabled={saving}>
            {saving ? 'Adding…' : <><Plus size={14} /> Add Endpoint</>}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="field">
      <label className="field__label">{label}</label>
      {children}
      {error && <span className="field__error">{error}</span>}
    </div>
  )
}

