import type { Job } from '@/types/database'
import { StatusBadge } from './StatusBadge'

interface Props {
  job: Job
  onEdit: (job: Job) => void
  onDelete: (id: string) => void
}

function timeAgo(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

export function JobCard({ job, onEdit, onDelete }: Props) {
  return (
    <div className="flex flex-col rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold text-gray-900">{job.company}</p>
          <p className="truncate text-sm text-gray-500">{job.title}</p>
        </div>
        <StatusBadge status={job.status} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-400">
        {job.location && <span>{job.location}</span>}
        {job.url && (
          <a
            href={job.url}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-700"
          >
            View posting
          </a>
        )}
        <span className="ml-auto">{timeAgo(job.created_at)}</span>
      </div>

      {job.notes && <p className="mt-2 line-clamp-2 text-xs text-gray-400">{job.notes}</p>}

      <div className="mt-4 flex justify-end gap-4">
        <button onClick={() => onEdit(job)} className="text-xs text-gray-400 hover:text-gray-800">
          Edit
        </button>
        <button
          onClick={() => onDelete(job.id)}
          className="text-xs text-red-400 hover:text-red-600"
        >
          Delete
        </button>
      </div>
    </div>
  )
}
