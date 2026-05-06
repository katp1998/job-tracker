import type { JobStatus } from '@/types/database'

export const STATUS_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  saved: ['applied', 'withdrawn'],
  applied: ['interview', 'rejected', 'ghosted', 'withdrawn'],
  interview: ['offer', 'rejected', 'ghosted', 'withdrawn'],
  offer: ['withdrawn'],
  rejected: [],
  ghosted: ['rejected'],
  withdrawn: [],
}

export const STATUS_LABELS: Record<JobStatus, string> = {
  saved: 'Saved',
  applied: 'Applied',
  interview: 'Interview',
  offer: 'Offer',
  rejected: 'Rejected',
  ghosted: 'Ghosted',
  withdrawn: 'Withdrawn',
}

export function isTerminal(status: JobStatus) {
  return STATUS_TRANSITIONS[status].length === 0
}
