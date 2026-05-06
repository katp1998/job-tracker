export type JobStatus =
  | 'saved'
  | 'applied'
  | 'interview'
  | 'offer'
  | 'rejected'
  | 'ghosted'
  | 'withdrawn'

export type Database = {
  public: {
    Tables: {
      jobs: {
        Row: {
          applied_at: string | null
          company: string
          created_at: string
          description: string | null
          follow_up_sent_at: string | null
          id: string
          last_contact_at: string | null
          location: string | null
          notes: string | null
          salary_currency: string
          salary_max: number | null
          salary_min: number | null
          status: string
          title: string
          updated_at: string
          url: string | null
          user_id: string
        }
        Insert: {
          applied_at?: string | null
          company: string
          created_at?: string
          description?: string | null
          follow_up_sent_at?: string | null
          id?: string
          last_contact_at?: string | null
          location?: string | null
          notes?: string | null
          salary_currency?: string
          salary_max?: number | null
          salary_min?: number | null
          status?: string
          title: string
          updated_at?: string
          url?: string | null
          user_id: string
        }
        Update: {
          applied_at?: string | null
          company?: string
          created_at?: string
          description?: string | null
          follow_up_sent_at?: string | null
          id?: string
          last_contact_at?: string | null
          location?: string | null
          notes?: string | null
          salary_currency?: string
          salary_max?: number | null
          salary_min?: number | null
          status?: string
          title?: string
          updated_at?: string
          url?: string | null
          user_id?: string
        }
        Relationships: []
      }
      job_events: {
        Row: {
          created_at: string
          description: string | null
          email_snippet: string | null
          email_subject: string | null
          from_status: string | null
          id: string
          job_id: string
          to_status: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          email_snippet?: string | null
          email_subject?: string | null
          from_status?: string | null
          id?: string
          job_id: string
          to_status?: string | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          email_snippet?: string | null
          email_subject?: string | null
          from_status?: string | null
          id?: string
          job_id?: string
          to_status?: string | null
          type?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Application-layer types with narrowed status typing
type DbJobRow = Database['public']['Tables']['jobs']['Row']
export type Job = Omit<DbJobRow, 'status'> & { status: JobStatus }

type DbJobEventRow = Database['public']['Tables']['job_events']['Row']
export type JobEvent = Omit<DbJobEventRow, 'type' | 'from_status' | 'to_status'> & {
  type: 'status_change' | 'email_received' | 'note_added' | 'manual_update'
  from_status: JobStatus | null
  to_status: JobStatus | null
}
