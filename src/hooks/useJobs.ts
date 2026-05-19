import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import type { Job, JobStatus } from '@/types/database'

export type JobInput = {
  company: string
  title: string
  status: JobStatus
  url?: string | null
  location?: string | null
  notes?: string | null
  salary_min?: number | null
  salary_max?: number | null
  salary_currency?: string
}

export function useJobs() {
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('jobs')
      .select('*')
      .order('created_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (err) setError(err.message)
        else setJobs((data ?? []) as Job[])
        setLoading(false)
      })

    const channel = supabase
      .channel('jobs-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'jobs' }, (payload) => {
        setJobs((prev) => [payload.new as Job, ...prev])
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'jobs' }, (payload) => {
        setJobs((prev) => prev.map((j) => (j.id === payload.new.id ? (payload.new as Job) : j)))
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'jobs' }, (payload) => {
        setJobs((prev) => prev.filter((j) => j.id !== payload.old.id))
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  async function addJob(input: JobInput) {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')
    const { data, error: err } = await supabase
      .from('jobs')
      .insert({
        user_id: user.id,
        company: input.company,
        title: input.title,
        status: input.status,
        url: input.url ?? null,
        location: input.location ?? null,
        notes: input.notes ?? null,
        description: null,
        salary_min: input.salary_min ?? null,
        salary_max: input.salary_max ?? null,
        salary_currency: input.salary_currency ?? 'GBP',
        applied_at: input.status === 'applied' ? new Date().toISOString() : null,
        last_contact_at: null,
        follow_up_sent_at: null,
      })
      .select()
      .single()
    if (err) throw new Error(err.message)
    setJobs((prev) => [data as Job, ...prev])
  }

  async function updateJob(id: string, input: JobInput) {
    const existing = jobs.find((j) => j.id === id)
    const appliedAt =
      existing?.applied_at ?? (input.status === 'applied' ? new Date().toISOString() : null)
    const { data, error: err } = await supabase
      .from('jobs')
      .update({
        company: input.company,
        title: input.title,
        status: input.status,
        url: input.url ?? null,
        location: input.location ?? null,
        notes: input.notes ?? null,
        salary_min: input.salary_min ?? null,
        salary_max: input.salary_max ?? null,
        salary_currency: input.salary_currency ?? 'GBP',
        applied_at: appliedAt,
      })
      .eq('id', id)
      .select()
      .single()
    if (err) throw new Error(err.message)
    setJobs((prev) => prev.map((j) => (j.id === id ? (data as Job) : j)))
  }

  async function deleteJob(id: string) {
    const { error: err } = await supabase.from('jobs').delete().eq('id', id)
    if (err) throw new Error(err.message)
    setJobs((prev) => prev.filter((j) => j.id !== id))
  }

  return { jobs, loading, error, addJob, updateJob, deleteJob }
}
