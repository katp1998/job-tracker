import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FiSearch, FiX } from 'react-icons/fi'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useJobs } from '@/hooks/useJobs'
import { JobTable, type SortKey, type SortDir } from '@/components/jobs/JobTable'
import { JobForm } from '@/components/jobs/JobForm'
import type { Job, JobStatus } from '@/types/database'

type Filter = JobStatus | 'all'

const TABS: { label: string; value: Filter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Saved', value: 'saved' },
  { label: 'Applied', value: 'applied' },
  { label: 'Interview', value: 'interview' },
  { label: 'Offer', value: 'offer' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'Ghosted', value: 'ghosted' },
]

function motivationalMessage(applied: number, offers: number) {
  if (offers > 0) return "You've got offers — great work!"
  if (applied === 0) return 'Start applying, you\'ve got this!'
  if (applied < 5) return 'Great start, keep the momentum going!'
  if (applied < 15) return 'You\'re putting in the work — it\'ll pay off!'
  if (applied < 30) return 'Impressive dedication, stay consistent!'
  return 'Incredible hustle — your next role is out there!'
}

export function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { jobs, loading, addJob, updateJob, deleteJob } = useJobs()

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [sortKey, setSortKey] = useState<SortKey>('updated_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Job | null>(null)

  async function handleSignOut() {
    await supabase.auth.signOut()
    navigate('/login', { replace: true })
  }

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortKey(key); setSortDir('desc') }
  }

  async function handleStatusChange(id: string, status: JobStatus) {
    const job = jobs.find(j => j.id === id)
    if (!job) return
    await updateJob(id, { company: job.company, title: job.title, status, url: job.url, location: job.location, notes: job.notes })
  }

  function openEdit(job: Job) {
    setEditing(job)
    setShowForm(true)
  }

  function closeForm() {
    setShowForm(false)
    setEditing(null)
  }

  const searched = search.trim()
    ? jobs.filter(j => j.company.toLowerCase().includes(search.toLowerCase()))
    : jobs
  const filtered = filter === 'all' ? searched : searched.filter(j => j.status === filter)

  const sorted = [...filtered].sort((a, b) => {
    const av = (a[sortKey] ?? '').toLowerCase()
    const bv = (b[sortKey] ?? '').toLowerCase()
    if (av === '' && bv !== '') return 1
    if (bv === '' && av !== '') return -1
    if (av < bv) return sortDir === 'asc' ? -1 : 1
    if (av > bv) return sortDir === 'asc' ? 1 : -1
    return 0
  })

  const activeCount = jobs.filter(j => ['applied', 'interview', 'offer'].includes(j.status)).length

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <h1 className="text-lg font-semibold text-gray-900">Job Tracker</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">{user?.email}</span>
            <button onClick={handleSignOut} className="text-sm text-gray-400 hover:text-gray-900">
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6 flex gap-6 text-sm">
          <Stat label="total" value={jobs.length} />
          <Stat label="active" value={activeCount} />
          <Stat label="interviewing" value={jobs.filter(j => j.status === 'interview').length} />
          <Stat label="offers" value={jobs.filter(j => j.status === 'offer').length} />
        </div>

        <div className="mb-4 flex items-center justify-between gap-4">
          <div className="relative w-64">
            <FiSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by company..."
              className="w-full rounded-lg border border-gray-300 py-2 pl-8 pr-8 text-sm outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700">
                <FiX size={14} />
              </button>
            )}
          </div>
          <div className="text-right">
            <p className="text-sm font-medium text-gray-900">
              {jobs.filter(j => j.status !== 'saved').length} applications sent
            </p>
            <p className="text-xs text-gray-400">{motivationalMessage(jobs.filter(j => j.status !== 'saved').length, jobs.filter(j => j.status === 'offer').length)}</p>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1">
            {TABS.map(tab => {
              const count = tab.value === 'all' ? null : jobs.filter(j => j.status === tab.value).length
              return (
                <button
                  key={tab.value}
                  onClick={() => setFilter(tab.value)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    filter === tab.value
                      ? 'bg-gray-900 text-white'
                      : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900'
                  }`}
                >
                  {tab.label}
                  {count !== null && (
                    <span className={`ml-1.5 text-xs ${filter === tab.value ? 'opacity-70' : 'text-gray-400'}`}>
                      {count}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
          >
            + Add job
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-gray-400">Loading...</p>
        ) : (
          <JobTable
            jobs={sorted}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={handleSort}
            onStatusChange={handleStatusChange}
            onEdit={openEdit}
            onDelete={deleteJob}
          />
        )}
      </main>

      {showForm && (
        <JobForm
          initial={editing ?? undefined}
          onSubmit={editing ? data => updateJob(editing.id, data) : addJob}
          onClose={closeForm}
        />
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <span className="text-gray-500">
      <strong className="text-gray-900">{value}</strong> {label}
    </span>
  )
}
