export type JobStatus =
  | 'saved'
  | 'applied'
  | 'interview'
  | 'offer'
  | 'rejected'
  | 'ghosted'
  | 'withdrawn'

export interface Job {
  id: string
  user_id: string
  company: string
  title: string
  description: string | null
  salary_min: number | null
  salary_max: number | null
  salary_currency: string
  location: string | null
  url: string | null
  status: JobStatus
  notes: string | null
  applied_at: string | null
  last_contact_at: string | null
  follow_up_sent_at: string | null
  created_at: string
  updated_at: string
}

export interface JobEvent {
  id: string
  job_id: string
  user_id: string
  type: 'status_change' | 'email_received' | 'note_added' | 'manual_update'
  from_status: JobStatus | null
  to_status: JobStatus | null
  description: string | null
  email_subject: string | null
  email_snippet: string | null
  created_at: string
}

export interface Database {
  public: {
    Tables: {
      jobs: {
        Row: Job
        Insert: Omit<Job, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Job, 'id' | 'user_id' | 'created_at'>>
      }
      job_events: {
        Row: JobEvent
        Insert: Omit<JobEvent, 'id' | 'created_at'>
        Update: Partial<Omit<JobEvent, 'id' | 'user_id' | 'created_at'>>
      }
    }
  }
}
