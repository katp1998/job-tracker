import { useState } from 'react'
import type { Job, JobStatus } from '@/types/database'
import type { JobInput } from '@/hooks/useJobs'
import { STATUS_TRANSITIONS, STATUS_LABELS, isTerminal } from '@/lib/jobStatus'

const ALL_STATUSES: JobStatus[] = ['saved', 'applied', 'interview', 'offer', 'rejected', 'ghosted', 'withdrawn']

interface Props {
  initial?: Job
  onSubmit: (data: JobInput) => Promise<void>
  onClose: () => void
}

export function JobForm({ initial, onSubmit, onClose }: Props) {
  const [company, setCompany] = useState(initial?.company ?? '')
  const [title, setTitle] = useState(initial?.title ?? '')
  const [url, setUrl] = useState(initial?.url ?? '')
  const [location, setLocation] = useState(initial?.location ?? '')
  const initialStatus = initial?.status ?? 'saved'
  const [status, setStatus] = useState<JobStatus>(initialStatus)
  const statusOptions: JobStatus[] = initial
    ? [initialStatus, ...STATUS_TRANSITIONS[initialStatus]]
    : ALL_STATUSES
  const [notes, setNotes] = useState(initial?.notes ?? '')
  const [salaryMin, setSalaryMin] = useState(initial?.salary_min?.toString() ?? '')
  const [salaryMax, setSalaryMax] = useState(initial?.salary_max?.toString() ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setError(null)
    try {
      await onSubmit({
        company: company.trim(),
        title: title.trim(),
        status,
        url: url.trim() || null,
        location: location.trim() || null,
        notes: notes.trim() || null,
        salary_min: salaryMin ? parseInt(salaryMin, 10) : null,
        salary_max: salaryMax ? parseInt(salaryMax, 10) : null,
      })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl" style={{ maxHeight: '90dvh' }}>
        <h2 className="mb-5 text-lg font-semibold text-gray-900">
          {initial ? 'Edit job' : 'Add job'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Company">
            <input
              value={company}
              onChange={e => setCompany(e.target.value)}
              placeholder="Acme Corp"
              required
              className={inputCls}
            />
          </Field>
          <Field label="Job title">
            <input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="Software Engineer"
              required
              className={inputCls}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Status">
              <select
                value={status}
                onChange={e => setStatus(e.target.value as JobStatus)}
                className={inputCls}
              disabled={!!initial && isTerminal(initialStatus)}
              >
                {statusOptions.map(s => (
                  <option key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Location">
              <input
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="Remote"
                className={inputCls}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Salary min">
              <input
                value={salaryMin}
                onChange={e => setSalaryMin(e.target.value.replace(/\D/g, ''))}
                placeholder="50000"
                className={inputCls}
              />
            </Field>
            <Field label="Salary max">
              <input
                value={salaryMax}
                onChange={e => setSalaryMax(e.target.value.replace(/\D/g, ''))}
                placeholder="80000"
                className={inputCls}
              />
            </Field>
          </div>
          <Field label="Posting URL">
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              placeholder="https://..."
              type="url"
              className={inputCls}
            />
          </Field>
          <Field label="Notes">
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Anything worth remembering about this role..."
              rows={3}
              className={`${inputCls} resize-none`}
            />
          </Field>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex justify-end gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-gray-500 hover:text-gray-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700 disabled:opacity-60"
            >
              {saving ? 'Saving...' : initial ? 'Save changes' : 'Add job'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

const inputCls =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">{label}</label>
      {children}
    </div>
  )
}
