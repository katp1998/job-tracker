-- Enable realtime for the jobs table so the web app
-- auto-updates when the browser extension adds a job.
alter publication supabase_realtime add table public.jobs;
