import type { JobStatus } from '@/types/database'

const config: Record<JobStatus, { label: string; classes: string }> = {
  saved:     { label: 'Saved',     classes: 'bg-gray-100 text-gray-600' },
  applied:   { label: 'Applied',   classes: 'bg-blue-100 text-blue-700' },
  interview: { label: 'Interview', classes: 'bg-amber-100 text-amber-700' },
  offer:     { label: 'Offer',     classes: 'bg-green-100 text-green-700' },
  rejected:  { label: 'Rejected',  classes: 'bg-red-100 text-red-600' },
  ghosted:   { label: 'Ghosted',   classes: 'bg-slate-100 text-slate-500' },
  withdrawn: { label: 'Withdrawn', classes: 'bg-orange-100 text-orange-700' },
}

export function StatusBadge({ status }: { status: JobStatus }) {
  const { label, classes } = config[status]
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${classes}`}>
      {label}
    </span>
  )
}
