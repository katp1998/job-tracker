'use strict'

const SUPABASE_URL = 'https://fruyhrczryssqtynszon.supabase.co'
const ANON_KEY = 'sb_publishable_68a4CD2nOXRFuNqMb1QxmQ_gpx7sFfB'
const APP_ORIGIN = 'https://katp1998.github.io'
const APP_URL = 'https://katp1998.github.io/job-tracker/'
const DASHBOARD_URL = 'https://katp1998.github.io/job-tracker/dashboard'
const STORAGE_KEY_PREFIX = 'sb-fruyhrczryssqtynszon'

let capturedDescription = null

// ── Utility ────────────────────────────────────────────────────

function withTimeout(promise, ms = 5000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms))
  ])
}

// ── Storage ────────────────────────────────────────────────────

async function getStoredSession() {
  const result = await chrome.storage.local.get('session')
  return result.session ?? null
}
async function setStoredSession(s) { await chrome.storage.local.set({ session: s }) }
async function clearStoredSession() { await chrome.storage.local.remove('session') }

// ── Session from web app ───────────────────────────────────────

async function getSessionFromWebApp() {
  let tabs = []
  try { tabs = await withTimeout(chrome.tabs.query({ url: `${APP_ORIGIN}/*` }), 2000) } catch { return null }
  for (const tab of tabs) {
    try {
      const results = await withTimeout(chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (prefix) => {
          const key = Object.keys(localStorage).find(k => k.startsWith(prefix) && k.endsWith('-auth-token'))
          if (!key) return null
          try {
            const d = JSON.parse(localStorage.getItem(key))
            if (!d?.access_token) return null
            return { access_token: d.access_token, refresh_token: d.refresh_token, expires_at: d.expires_at, user_id: d.user?.id, email: d.user?.email }
          } catch { return null }
        },
        args: [STORAGE_KEY_PREFIX]
      }), 3000)
      const s = results?.[0]?.result
      if (s?.access_token) return s
    } catch {}
  }
  return null
}

// ── Auth ───────────────────────────────────────────────────────

async function doRefresh(session) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON_KEY },
    body: JSON.stringify({ refresh_token: session.refresh_token })
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error_description || data.message || 'Refresh failed')
  return {
    access_token: data.access_token, refresh_token: data.refresh_token,
    expires_at: data.expires_at ?? Math.floor(Date.now() / 1000) + (data.expires_in ?? 3600),
    user_id: data.user?.id ?? session.user_id, email: data.user?.email ?? session.email
  }
}

async function getValidSession() {
  const web = await getSessionFromWebApp()
  if (web?.access_token) { await setStoredSession(web); return web }
  const stored = await getStoredSession()
  if (!stored) return null
  const now = Math.floor(Date.now() / 1000)
  if (!stored.expires_at || stored.expires_at - now < 60) {
    try { const r = await doRefresh(stored); await setStoredSession(r); return r }
    catch { await clearStoredSession(); return null }
  }
  return stored
}

// ── Job scraper — runs directly inside the tab via executeScript ──
// Self-contained function (no closures, no imports allowed).

function scraperFunc() {
  function getSD() {
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const raw = JSON.parse(s.textContent)
        const items = raw['@graph'] ? raw['@graph'] : Array.isArray(raw) ? raw : [raw]
        const d = items.find(x => x?.['@type'] === 'JobPosting')
        if (!d) continue
        let loc = null
        if (d.jobLocation) {
          const f = Array.isArray(d.jobLocation) ? d.jobLocation[0] : d.jobLocation
          loc = f?.address?.addressLocality || f?.address?.addressRegion || null
        }
        if (!loc && d.jobLocationType === 'TELECOMMUTE') loc = 'Remote'
        const desc = d.description
          ? d.description.replace(/<[^>]*>/g, ' ').replace(/&\w+;/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 8000)
          : null
        const title = d.title?.trim() || null
        const company = (typeof d.hiringOrganization === 'string' ? d.hiringOrganization : d.hiringOrganization?.name)?.trim() || null
        if (title || company) return { title, company, location: loc, description: desc }
      } catch {}
    }
    return null
  }

  function parseTitle() {
    let raw = document.title.trim().replace(/^\(\d+\)\s+/, '')
    raw = raw.replace(/\s*[|·•–—]\s*(LinkedIn|Indeed|Glassdoor|Reed|TotalJobs|CWJobs|Adzuna|Monster|Workday|Greenhouse|Lever).*$/i, '').trim()
    if (!raw || /^(search|jobs?|careers?|results?|home|dashboard|feed)$/i.test(raw)) return null
    const m = raw.match(/^(.+?)\s+at\s+(.+)$/i)
    if (m) return { title: m[1].trim(), company: m[2].trim() }
    const parts = raw.split(/\s+-\s+/)
    if (parts.length >= 2) return { title: parts[0].trim(), company: parts[1].trim() }
    return { title: raw, company: null }
  }

  function txt(el) { return el?.textContent?.trim() || null }
  function q(sel) { return txt(document.querySelector(sel)) }

  // Find a heading (any tag or role) with job-title-like content
  function findHeading(container) {
    // Real heading tags first
    for (const tag of ['h1', 'h2', 'h3']) {
      for (const el of container.querySelectorAll(tag)) {
        const t = txt(el)
        if (t && t.length > 3 && t.length < 200) return t
      }
    }
    // Aria headings (LinkedIn uses divs with role="heading")
    for (const el of container.querySelectorAll('[role="heading"]')) {
      const t = txt(el)
      if (t && t.length > 3 && t.length < 200) return t
    }
    return null
  }

  // Find first /company/ link with readable text
  function findCompany(container) {
    for (const a of container.querySelectorAll('a[href*="/company/"]')) {
      const t = a.textContent.trim() || a.getAttribute('aria-label')?.trim()
      if (t && t.length > 1 && t.length < 120) return t
    }
    return null
  }

  const host = location.hostname
  const sd = getSD()
  const pt = parseTitle()

  // ── LinkedIn ───────────────────────────────────────────────
  if (host.includes('linkedin.com')) {
    if (sd?.title || sd?.company) {
      return { source: 'LinkedIn', url: location.href, title: sd.title, company: sd.company, location: sd.location, description: sd.description }
    }

    // LinkedIn now uses fully hashed CSS class names, so class-based selectors
    // don't work. The right-side preview panel also loads asynchronously via
    // the SPA, so we poll until either an Apply button or h1 appears (up to 4s).
    const isDetailPage = /^\/jobs\/view\//.test(location.pathname)

    return new Promise((resolve) => {
      let attempts = 0
      const MAX = 10  // 10 × 400 ms = 4 s

      function attempt() {
        attempts++

        // "Easy Apply" / "Apply" button only exists once the preview panel is loaded
        const applyBtn =
          document.querySelector('button.jobs-apply-button') ||
          [...document.querySelectorAll('button')].find(b =>
            /^(easy apply|apply now|apply)$/i.test(b.textContent.trim())
          )

        // h1 on search pages is the job title in the right panel
        const h1s = [...document.querySelectorAll('h1')]
          .map(e => e.textContent.trim())
          .filter(t => t.length > 3 && t.length < 200)

        const panelLoaded = applyBtn || h1s.length > 0

        if (!panelLoaded && attempts < MAX) {
          setTimeout(attempt, 400)
          return
        }

        // Panel content is now in the DOM (or we timed out)
        // Build a scoped search root from the Apply button, or fall back to document
        const searchRoot = applyBtn
          ? (applyBtn.closest('section') || applyBtn.closest('article') || applyBtn.closest('div[class]') || document)
          : document

        // Job title: h1 that isn't a generic page/site title
        const genericTitles = new Set(['linkedin', 'jobs', 'sign in', 'join linkedin'])
        const title =
          h1s.find(t => !genericTitles.has(t.toLowerCase())) ||
          [...(searchRoot !== document ? searchRoot.querySelectorAll('h2') : [])].map(e => e.textContent.trim()).find(t => t.length > 3) ||
          (isDetailPage ? pt?.title : null)

        // Company: first /company/ link with readable text
        const company =
          findCompany(searchRoot !== document ? searchRoot : (document.querySelector('main') || document.body)) ||
          (isDetailPage ? pt?.company : null)

        // Location: aria-label on location buttons/spans, or spans near the apply area
        let jobLoc = null
        if (applyBtn) {
          const card = applyBtn.closest('section') || applyBtn.closest('article') || applyBtn.parentElement
          if (card) {
            // Location often appears as plain text spans near the top of the card
            const spans = [...card.querySelectorAll('span')]
              .map(s => s.textContent.trim())
              .filter(t => t.length > 2 && t.length < 80 && /[,·]|remote|hybrid|on-site|london|new york/i.test(t))
            jobLoc = spans[0] || null
          }
        }

        console.log('[Job Tracker] LinkedIn result (attempts=' + attempts + '):', { title, company, applyBtn: !!applyBtn, h1s })
        resolve({ source: 'LinkedIn', url: location.href, title, company, location: jobLoc, description: sd?.description })
      }

      attempt()
    })
  }

  // ── Indeed ────────────────────────────────────────────────
  if (host.includes('indeed.com')) {
    return {
      source: 'Indeed', url: location.href,
      title: sd?.title || pt?.title || q('[data-testid="jobsearch-JobInfoHeader-title"]') || q('h1'),
      company: sd?.company || pt?.company || q('[data-testid="inlineHeader-companyName"] a') || q('[data-testid="inlineHeader-companyName"]'),
      location: sd?.location || q('[data-testid="job-location"]'),
      description: sd?.description || q('#jobDescriptionText')
    }
  }

  // ── Glassdoor ─────────────────────────────────────────────
  if (host.includes('glassdoor.')) {
    return {
      source: 'Glassdoor', url: location.href,
      title: sd?.title || pt?.title || q('[data-test="job-title"]') || q('h1'),
      company: sd?.company || pt?.company || q('[data-test="employer-name"]'),
      location: sd?.location || q('[data-test="location"]'),
      description: sd?.description
    }
  }

  // ── Lever ─────────────────────────────────────────────────
  if (host.includes('lever.co')) {
    return {
      source: 'Lever', url: location.href,
      title: sd?.title || q('.posting-headline h2') || q('[data-qa="posting-name"]') || q('h2'),
      company: sd?.company || document.querySelector('.main-header-logo img')?.alt || pt?.company,
      location: sd?.location || q('.location') || q('[data-qa="location"]'),
      description: sd?.description || q('.posting-description')
    }
  }

  // ── Greenhouse ───────────────────────────────────────────
  if (host.includes('greenhouse.io')) {
    return {
      source: 'Greenhouse', url: location.href,
      title: sd?.title || q('h1.app-title') || q('h1'),
      company: sd?.company || q('.company-name') || pt?.company,
      location: sd?.location || q('.location'),
      description: sd?.description
    }
  }

  // ── Workday ──────────────────────────────────────────────
  if (host.includes('myworkdayjobs.com')) {
    return {
      source: 'Workday', url: location.href,
      title: sd?.title || q('[data-automation-id="jobPostingHeader"]'),
      company: sd?.company || document.querySelector('[data-automation-id="logo"] img')?.alt,
      location: sd?.location || q('[data-automation-id="locations"]'),
      description: sd?.description
    }
  }

  // ── Reed ─────────────────────────────────────────────────
  if (host.includes('reed.co.uk')) {
    return {
      source: 'Reed', url: location.href,
      title: sd?.title || pt?.title || q('h1[itemprop="title"]') || q('h1'),
      company: sd?.company || q('[itemprop="hiringOrganization"] [itemprop="name"]'),
      location: sd?.location || q('[itemprop="addressLocality"]'),
      description: sd?.description
    }
  }

  // ── TotalJobs / CWJobs ───────────────────────────────────
  if (host.includes('totaljobs.com') || host.includes('cwjobs.co.uk')) {
    return {
      source: 'TotalJobs', url: location.href,
      title: sd?.title || pt?.title || q('h1.job-title') || q('h1'),
      company: sd?.company || q('.companyInfo-name') || q('[data-at="job-company"]'),
      location: sd?.location || q('.job-location'),
      description: sd?.description
    }
  }

  // ── Generic fallback ─────────────────────────────────────
  return {
    source: null, url: location.href,
    title: sd?.title || pt?.title || q('h1'),
    company: sd?.company || pt?.company,
    location: sd?.location,
    description: sd?.description
  }
}

// ── Get job data ───────────────────────────────────────────────

function canInject(url) {
  if (!url) return false
  return !['chrome://', 'chrome-extension://', 'about:', 'edge://', 'moz-extension://'].some(p => url.startsWith(p))
}

async function getJobData(tabId, tabUrl) {
  if (!canInject(tabUrl)) return null
  try {
    const results = await withTimeout(
      chrome.scripting.executeScript({ target: { tabId }, func: scraperFunc }),
      6000
    )
    const job = results?.[0]?.result
    console.log('[Job Tracker] scraped:', job)
    return job || null
  } catch (e) {
    console.warn('[Job Tracker] scrape failed:', e.message)
    return null
  }
}

// ── Supabase API ───────────────────────────────────────────────

async function insertJob(session, job) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/jobs`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json', apikey: ANON_KEY,
      Authorization: `Bearer ${session.access_token}`, Prefer: 'return=minimal'
    },
    body: JSON.stringify({
      user_id: session.user_id, company: job.company, title: job.title,
      status: job.status, url: job.url || null, location: job.location || null,
      notes: job.notes || null, description: job.description || null,
      salary_min: job.salaryMin ? Number(job.salaryMin) : null,
      salary_max: job.salaryMax ? Number(job.salaryMax) : null,
      salary_currency: job.currency || 'GBP',
      applied_at: job.status === 'applied' ? new Date().toISOString() : null,
      last_contact_at: null, follow_up_sent_at: null
    })
  })
  if (!res.ok) {
    const text = await res.text()
    let msg = text
    try { msg = JSON.parse(text).message || text } catch {}
    throw new Error(msg || 'Failed to add job')
  }
}

// ── UI helpers ─────────────────────────────────────────────────

function showView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'))
  document.getElementById(`view-${name}`).classList.add('active')
}
function showEl(el) { el.style.display = '' }
function hideEl(el) { el.style.display = 'none' }
function showError(el, msg) { el.textContent = msg; showEl(el) }
function setActiveAccount(s) { document.getElementById('user-email').textContent = s?.email ?? '' }

function prefillForm(job, tabUrl) {
  capturedDescription = job?.description || null
  const badge = document.getElementById('source-badge')
  const warn = document.getElementById('scrape-warn')
  if (job?.source) {
    document.getElementById('source-name').textContent = `Captured from ${job.source}`
    showEl(badge)
  } else { hideEl(badge) }
  document.getElementById('company').value = job?.company || ''
  document.getElementById('job-title').value = job?.title || ''
  document.getElementById('location').value = job?.location || ''
  document.getElementById('job-url').value = job?.url || tabUrl || ''
  if (job && !job.company && !job.title) showEl(warn)
  else hideEl(warn)
}

function resetForm() {
  capturedDescription = null
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
  showView('form')
  prefillForm({ url: tab.url }, tab.url)
  try {
    const job = await getJobData(tab.id, tab.url)
    if (job) prefillForm(job, tab.url)
  } catch {}
  const company = document.getElementById('company')
  const title = document.getElementById('job-title')
  if (!company.value) company.focus()
  else if (!title.value) title.focus()
}

// ── Main ───────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async () => {
  const formError = document.getElementById('form-error')
  try {
    const session = await getValidSession()
    if (!session) showView('login')
    else await loadFormForCurrentTab(session)
  } catch { showView('login') }

  document.getElementById('google-login-btn').addEventListener('click', async () => {
    document.getElementById('google-login-btn').disabled = true
    await chrome.tabs.create({ url: APP_URL, active: true })
  })

  document.getElementById('logout-btn').addEventListener('click', async () => {
    await clearStoredSession()
    showView('login')
  })

  document.getElementById('submit-btn').addEventListener('click', async () => {
    hideEl(formError)
    const company = document.getElementById('company').value.trim()
    const title = document.getElementById('job-title').value.trim()
    if (!company) { showError(formError, 'Company name is required.'); document.getElementById('company').focus(); return }
    if (!title) { showError(formError, 'Job title is required.'); document.getElementById('job-title').focus(); return }
    const session = await getValidSession()
    if (!session) { showView('login'); return }
    const btn = document.getElementById('submit-btn')
    btn.disabled = true; btn.textContent = 'Adding…'
    try {
      await insertJob(session, {
        company, title,
        status: document.getElementById('status').value,
        url: document.getElementById('job-url').value.trim(),
        location: document.getElementById('location').value.trim(),
        notes: document.getElementById('notes').value.trim(),
        description: capturedDescription,
        salaryMin: document.getElementById('salary-min').value,
        salaryMax: document.getElementById('salary-max').value,
        currency: document.getElementById('currency').value
      })
      document.getElementById('success-info').textContent = `${title} at ${company}`
      document.getElementById('dashboard-link').href = DASHBOARD_URL
      showView('success')
    } catch (err) { showError(formError, err.message) }
    finally { btn.disabled = false; btn.textContent = 'Add to Job Tracker' }
  })

  document.getElementById('add-another-btn').addEventListener('click', async () => {
    const session = await getValidSession()
    resetForm()
    await loadFormForCurrentTab(session)
  })
})
