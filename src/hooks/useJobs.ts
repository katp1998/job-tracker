import { useCallback, useEffect, useState } from 'react'
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

  const fetchJobs = useCallback(async () => {
    setLoading(true)
    const { data, error: err } = await supabase
      .from('jobs')
      .select('*')
      .order('created_at', { ascending: false })
    if (err) setError(err.message)
    else setJobs(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    fetchJobs()
  }, [fetchJobs])

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
        salary_currency: input.salary_currency ?? 'USD',
        applied_at: null,
        last_contact_at: null,
        follow_up_sent_at: null,
      })
      .select()
      .single()
    if (err) throw new Error(err.message)
    setJobs(prev => [data, ...prev])
  }

  async function updateJob(id: string, input: JobInput) {
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
        salary_currency: input.salary_currency ?? 'USD',
      })
      .eq('id', id)
      .select()
      .single()
    if (err) throw new Error(err.message)
    setJobs(prev => prev.map(j => (j.id === id ? data : j)))
  }

  async function deleteJob(id: string) {
    const { error: err } = await supabase.from('jobs').delete().eq('id', id)
    if (err) throw new Error(err.message)
    setJobs(prev => prev.filter(j => j.id !== id))
  }

  return { jobs, loading, error, addJob, updateJob, deleteJob }
}
