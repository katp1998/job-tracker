'use strict'

const SUPABASE_URL = 'https://fruyhrczryssqtynszon.supabase.co'
const ANON_KEY = 'sb_publishable_68a4CD2nOXRFuNqMb1QxmQ_gpx7sFfB'
const APP_ORIGIN = 'https://katp1998.github.io'
const APP_URL = 'https://katp1998.github.io/job-tracker/'
const DASHBOARD_URL = 'https://katp1998.github.io/job-tracker/dashboard'

// Supabase localStorage key prefix used by the web app
const STORAGE_KEY_PREFIX = 'sb-fruyhrczryssqtynszon'

// ── Extension storage ──────────────────────────────────────────

async function getStoredSession() {
  const result = await chrome.storage.local.get('session')
  return result.session ?? null
}

async function setStoredSession(session) {
  await chrome.storage.local.set({ session })
}

async function clearStoredSession() {
  await chrome.storage.local.remove('session')
}

// ── Read session from the Job Tracker web app ──────────────────
// Reads the Supabase session directly from the web app's
// localStorage — works on any page of the app (dashboard, login, etc.)

async function getSessionFromWebApp() {
  let tabs = []
  try {
    tabs = await chrome.tabs.query({ url: `${APP_ORIGIN}/*` })
  } catch {
    return null
  }
  if (tabs.length === 0) return null

  for (const tab of tabs) {
    try {
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (keyPrefix) => {
          const key = Object.keys(localStorage).find(
            k => k.startsWith(keyPrefix) && k.endsWith('-auth-token')
          )
          if (!key) return null
          try {
            const data = JSON.parse(localStorage.getItem(key))
            if (!data?.access_token) return null
            return {
              access_token: data.access_token,
              refresh_token: data.refresh_token,
              expires_at: data.expires_at,
              user_id: data.user?.id,
              email: data.user?.email
            }
          } catch {
            return null
          }
        },
        args: [STORAGE_KEY_PREFIX]
      })
      const session = results?.[0]?.result
      if (session?.access_token) return session
    } catch { /* tab inaccessible */ }
  }
  return null
}

// ── Token refresh ──────────────────────────────────────────────

async function doRefresh(session) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON_KEY },
    body: JSON.stringify({ refresh_token: session.refresh_token })
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error_description || data.message || 'Token refresh failed')
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: data.expires_at ?? Math.floor(Date.now() / 1000) + (data.expires_in ?? 3600),
    user_id: data.user?.id ?? session.user_id,
    email: data.user?.email ?? session.email
  }
}

// Priority: web app session > stored session > null (shows login)
async function getValidSession() {
  // 1. Always prefer the web app's live session (reflects current Google auth state)
  const webSession = await getSessionFromWebApp()
  if (webSession?.access_token) {
    await setStoredSession(webSession)
    return webSession
  }

  // 2. Fall back to a previously stored session
  const stored = await getStoredSession()
  if (!stored) return null

  const now = Math.floor(Date.now() / 1000)
  if (!stored.expires_at || stored.expires_at - now < 60) {
    try {
      const refreshed = await doRefresh(stored)
      await setStoredSession(refreshed)
      return refreshed
    } catch {
      await clearStoredSession()
      return null
    }
  }
  return stored
}

// ── Supabase API ───────────────────────────────────────────────

async function insertJob(session, job) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/jobs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: ANON_KEY,
      Authorization: `Bearer ${session.access_token}`,
      Prefer: 'return=minimal'
    },
    body: JSON.stringify({
      user_id: session.user_id,
      company: job.company,
      title: job.title,
      status: job.status,
      url: job.url || null,
      location: job.location || null,
      notes: job.notes || null,
      description: null,
      salary_min: job.salaryMin ? Number(job.salaryMin) : null,
      salary_max: job.salaryMax ? Number(job.salaryMax) : null,
      salary_currency: job.currency || 'GBP',
      applied_at: job.status === 'applied' ? new Date().toISOString() : null,
      last_contact_at: null,
      follow_up_sent_at: null
    })
  })
  if (!res.ok) {
    const text = await res.text()
    let msg = text
    try { msg = JSON.parse(text).message || text } catch {}
    throw new Error(msg || 'Failed to add job')
  }
}

// ── Tab / scraping ─────────────────────────────────────────────

function canInject(url) {
  if (!url) return false
  const blocked = ['chrome://', 'chrome-extension://', 'about:', 'edge://', 'moz-extension://']
  return !blocked.some(p => url.startsWith(p))
}

async function getJobData(tabId, tabUrl) {
  try {
    return await chrome.tabs.sendMessage(tabId, { type: 'GET_JOB_DATA' })
  } catch { /* content script not running yet */ }

  if (canInject(tabUrl)) {
    try {
      await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] })
      return await chrome.tabs.sendMessage(tabId, { type: 'GET_JOB_DATA' })
    } catch { /* injection failed */ }
  }

  return { url: tabUrl, title: null, company: null, location: null, source: null }
}

// ── UI helpers ─────────────────────────────────────────────────

function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'))
  document.getElementById(`view-${name}`).classList.add('active')
}

function showEl(el) { el.style.display = '' }
function hideEl(el) { el.style.display = 'none' }

function showError(el, msg) {
  el.textContent = msg
  showEl(el)
}

function setActiveAccount(session) {
  document.getElementById('user-email').textContent = session?.email ?? ''
}

function prefillForm(job, tabUrl) {
  const badge = document.getElementById('source-badge')
  if (job?.source) {
    document.getElementById('source-name').textContent = `Captured from ${job.source}`
    showEl(badge)
  } else {
    hideEl(badge)
  }
  document.getElementById('company').value = job?.company || ''
  document.getElementById('job-title').value = job?.title || ''
  document.getElementById('location').value = job?.location || ''
  document.getElementById('job-url').value = job?.url || tabUrl || ''
}

function resetForm() {
  document.getElementById('notes').value = ''
  document.getElementById('salary-min').value = ''
  document.getElementById('salary-max').value = ''
  document.getElementById('status').value = 'saved'
  hideEl(document.getElementById('form-error'))
}

// ── Boot ───────────────────────────────────────────────────────

async function loadFormForCurrentTab(session) {
  setActiveAccount(session)
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  const job = await getJobData(tab.id, tab.url)
  showView('form')
  prefillForm(job, tab.url)
  const company = document.getElementById('company')
  const title = document.getElementById('job-title')
  if (!company.value) company.focus()
  else if (!title.value) title.focus()
}

document.addEventListener('DOMContentLoaded', async () => {
  const formError = document.getElementById('form-error')

  const session = await getValidSession()
  if (!session) {
    showView('login')
  } else {
    await loadFormForCurrentTab(session)
  }

  // ── Google sign-in ─────────────────────────────────────────
  // Opens the web app login page; the popup closes when the user
  // switches tabs (Chrome behaviour). They click the icon again
  // after signing in, and getSessionFromWebApp() picks it up.

  document.getElementById('google-login-btn').addEventListener('click', async () => {
    const btn = document.getElementById('google-login-btn')
    btn.disabled = true
    await chrome.tabs.create({ url: APP_URL, active: true })
    // Popup closes automatically here when the new tab gets focus
  })

  // ── Logout ─────────────────────────────────────────────────

  document.getElementById('logout-btn').addEventListener('click', async () => {
    await clearStoredSession()
    showView('login')
  })

  // ── Submit ─────────────────────────────────────────────────

  document.getElementById('submit-btn').addEventListener('click', async () => {
    hideEl(formError)

    const company = document.getElementById('company').value.trim()
    const title = document.getElementById('job-title').value.trim()

    if (!company) {
      showError(formError, 'Company name is required.')
      document.getElementById('company').focus()
      return
    }
    if (!title) {
      showError(formError, 'Job title is required.')
      document.getElementById('job-title').focus()
      return
    }

    const session = await getValidSession()
    if (!session) {
      showView('login')
      return
    }

    const btn = document.getElementById('submit-btn')
    btn.disabled = true
    btn.textContent = 'Adding…'

    try {
      await insertJob(session, {
        company,
        title,
        status: document.getElementById('status').value,
        url: document.getElementById('job-url').value.trim(),
        location: document.getElementById('location').value.trim(),
        notes: document.getElementById('notes').value.trim(),
        salaryMin: document.getElementById('salary-min').value,
        salaryMax: document.getElementById('salary-max').value,
        currency: document.getElementById('currency').value
      })

      document.getElementById('success-info').textContent = `${title} at ${company}`
      document.getElementById('dashboard-link').href = DASHBOARD_URL
      showView('success')
    } catch (err) {
      showError(formError, err.message)
    } finally {
      btn.disabled = false
      btn.textContent = 'Add to Job Tracker'
    }
  })

  // ── Add another ────────────────────────────────────────────

  document.getElementById('add-another-btn').addEventListener('click', async () => {
    const session = await getValidSession()
    resetForm()
    await loadFormForCurrentTab(session)
  })
})
