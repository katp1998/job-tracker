import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FiArrowUp, FiArrowDown, FiArrowUpRight, FiChevronDown, FiEdit2, FiTrash2 } from 'react-icons/fi'
import { TbArrowsUpDown } from 'react-icons/tb'
import type { Job, JobStatus } from '@/types/database'
import { STATUS_TRANSITIONS, STATUS_LABELS, isTerminal } from '@/lib/jobStatus'

const STATUS_CLASSES: Record<JobStatus, string> = {
  saved:     'bg-gray-100 text-gray-600',
  applied:   'bg-blue-100 text-blue-700',
  interview: 'bg-amber-100 text-amber-700',
  offer:     'bg-green-100 text-green-700',
  rejected:  'bg-red-100 text-red-600',
  ghosted:   'bg-slate-100 text-slate-500',
  withdrawn: 'bg-orange-100 text-orange-700',
}

const STATUS_DOT: Record<JobStatus, string> = {
  saved:     'bg-gray-400',
  applied:   'bg-blue-500',
  interview: 'bg-amber-500',
  offer:     'bg-green-500',
  rejected:  'bg-red-500',
  ghosted:   'bg-slate-400',
  withdrawn: 'bg-orange-500',
}

export type SortKey = 'title' | 'location' | 'applied_at' | 'updated_at'
export type SortDir = 'asc' | 'desc'

interface Props {
  jobs: Job[]
  sortKey: SortKey
  sortDir: SortDir
  onSort: (key: SortKey) => void
  onStatusChange: (id: string, status: JobStatus) => void
  onEdit: (job: Job) => void
  onDelete: (id: string) => void
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatSalary(min: number | null, max: number | null, currency: string) {
  if (!min && !max) return '—'
  const sym = currency === 'USD' ? '$' : currency === 'GBP' ? '£' : currency === 'EUR' ? '€' : currency
  const fmt = (n: number) => n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`
  if (min && max) return `${sym}${fmt(min)} – ${sym}${fmt(max)}`
  if (min) return `${sym}${fmt(min)}+`
  return `up to ${sym}${fmt(max!)}`
}

function StatusDropdown({ jobId, status, onChange }: {
  jobId: string
  status: JobStatus
  onChange: (id: string, status: JobStatus) => void
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const triggerRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClick(e: MouseEvent) {
      if (
        menuRef.current?.contains(e.target as Node) ||
        triggerRef.current?.contains(e.target as Node)
      ) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const terminal = isTerminal(status)
  const options = STATUS_TRANSITIONS[status]

  function handleOpen() {
    if (triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.left })
    }
    setOpen(o => !o)
  }

  if (terminal) {
    return (
      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASSES[status]}`}>
        {STATUS_LABELS[status]}
      </span>
    )
  }

  return (
    <>
      <button
        ref={triggerRef}
        onClick={handleOpen}
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASSES[status]}`}
      >
        {STATUS_LABELS[status]}
        <FiChevronDown size={11} />
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left }}
          className="z-50 w-36 rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
        >
          {options.map(s => (
            <button
              key={s}
              onClick={() => { onChange(jobId, s); setOpen(false) }}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-gray-600 hover:bg-gray-50"
            >
              <span className={`h-2 w-2 flex-shrink-0 rounded-full ${STATUS_DOT[s]}`} />
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  )
}

export function JobTable({ jobs, sortKey, sortDir, onSort, onStatusChange, onEdit, onDelete }: Props) {
  function SortHeader({ label, col }: { label: string; col: SortKey }) {
    const active = sortKey === col
    return (
      <th
        className="cursor-pointer select-none whitespace-nowrap px-4 py-3 text-left text-xs font-medium text-gray-500 hover:text-gray-900"
        onClick={() => onSort(col)}
      >
        <span className="inline-flex items-center gap-1">
          {label}
          <span className="text-gray-400">
            {active ? (sortDir === 'asc' ? <FiArrowUp size={12} /> : <FiArrowDown size={12} />) : <TbArrowsUpDown size={12} />}
          </span>
        </span>
      </th>
    )
  }

  if (jobs.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 py-20 text-center">
        <p className="text-sm text-gray-400">No jobs here yet.</p>
      </div>
    )
  }

  return (
    <>
      {/* Mobile card list */}
      <div className="md:hidden divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white shadow-sm">
        {jobs.map(job => (
          <div key={job.id} className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-gray-900">{job.company}</p>
                <p className="text-sm text-gray-500">{job.title}</p>
              </div>
              <StatusDropdown jobId={job.id} status={job.status} onChange={onStatusChange} />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
              {job.location && <span>{job.location}</span>}
              {(job.salary_min || job.salary_max) && (
                <span>{formatSalary(job.salary_min, job.salary_max, job.salary_currency)}</span>
              )}
              {job.applied_at && <span>Applied {formatDate(job.applied_at)}</span>}
              {job.url && (
                <a href={job.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-blue-500 hover:underline">
                  View posting <FiArrowUpRight size={11} />
                </a>
              )}
            </div>
            <div className="mt-3 flex justify-end gap-2">
              <button onClick={() => onEdit(job)} className="rounded p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-800">
                <FiEdit2 size={15} />
              </button>
              <button onClick={() => onDelete(job.id)} className="rounded p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-500">
                <FiTrash2 size={15} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Company</th>
              <SortHeader label="Position" col="title" />
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Status</th>
              <SortHeader label="Location" col="location" />
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500">Salary</th>
              <SortHeader label="Applied" col="applied_at" />
              <SortHeader label="Updated" col="updated_at" />
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {jobs.map(job => (
              <tr key={job.id} className="group hover:bg-gray-50">
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-900">{job.company}</p>
                  {job.url && (
                    <a href={job.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-xs text-blue-500 hover:underline">
                      View posting <FiArrowUpRight size={11} />
                    </a>
                  )}
                </td>
                <td className="px-4 py-3 text-gray-700">{job.title}</td>
                <td className="px-4 py-3">
                  <StatusDropdown jobId={job.id} status={job.status} onChange={onStatusChange} />
                </td>
                <td className="px-4 py-3 text-gray-500">{job.location ?? '—'}</td>
                <td className="px-4 py-3 text-gray-500">{formatSalary(job.salary_min, job.salary_max, job.salary_currency)}</td>
                <td className="px-4 py-3 text-gray-500">{formatDate(job.applied_at)}</td>
                <td className="px-4 py-3 text-gray-500">{formatDate(job.updated_at)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2 opacity-0 transition-opacity group-hover:opacity-100">
                    <button onClick={() => onEdit(job)} className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-800">
                      <FiEdit2 size={14} />
                    </button>
                    <button onClick={() => onDelete(job.id)} className="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500">
                      <FiTrash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
