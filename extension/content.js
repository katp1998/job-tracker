'use strict'

// ── Layer 1: structured data (application/ld+json) ─────────────
// Most job sites embed a JobPosting schema block — far more
// reliable than CSS selectors which change with every redesign.

function getStructuredData() {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]')
  for (const script of scripts) {
    try {
      const raw = JSON.parse(script.textContent)

      // Unwrap common container formats: plain object, array, or @graph wrapper
      let candidates = []
      if (Array.isArray(raw)) {
        candidates = raw
      } else if (raw['@graph'] && Array.isArray(raw['@graph'])) {
        candidates = raw['@graph']
      } else {
        candidates = [raw]
      }

      const data = candidates.find(d => d?.['@type'] === 'JobPosting')
      if (!data) continue

      // Location
      let loc = null
      if (data.jobLocation) {
        const first = Array.isArray(data.jobLocation)
          ? data.jobLocation[0]
          : data.jobLocation
        loc =
          first?.address?.addressLocality ||
          first?.address?.addressRegion ||
          first?.address?.streetAddress ||
          (typeof first === 'string' ? first : null)
      }
      if (!loc && data.jobLocationType === 'TELECOMMUTE') loc = 'Remote'

      // Description — strip HTML tags and decode entities
      let desc = null
      if (data.description) {
        desc = data.description
          .replace(/<[^>]*>/g, ' ')
          .replace(/&amp;/g, '&')
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&quot;/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/&nbsp;/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 8000)
      }

      const title = data.title?.trim() || null
      const company =
        (typeof data.hiringOrganization === 'string'
          ? data.hiringOrganization
          : data.hiringOrganization?.name)?.trim() || null

      if (title || company) {
        return { title, company, location: loc, description: desc }
      }
    } catch { /* malformed JSON — try next script tag */ }
  }
  return null
}

// ── Layer 2: page title parsing ────────────────────────────────
// Works on virtually every job site because they all put the job
// title (and often company) in the browser tab title.

function parsePageTitle() {
  let raw = document.title.trim()
  if (!raw) return null

  // Strip notification badge: "(3) Senior Engineer at Google | LinkedIn"
  raw = raw.replace(/^\(\d+\)\s+/, '')

  // Strip known site suffixes
  raw = raw.replace(
    /\s*[|·•–—]\s*(LinkedIn|Indeed(?:\.com)?|Glassdoor(?:\.(?:com|co\.uk))?|Reed(?:\.co\.uk)?|TotalJobs(?:\.com)?|CWJobs(?:\.co\.uk)?|Adzuna(?:\.(?:com|co\.uk))?|Monster(?:\.com)?|Workday|Greenhouse|Lever|JobSite|CV-Library|Guardian Jobs|Jobs\.ac\.uk|Jobsite).*$/i,
    ''
  ).trim()

  if (!raw) return null

  // "Senior Engineer at Google" (LinkedIn primary format)
  const atMatch = raw.match(/^(.+?)\s+at\s+(.+)$/i)
  if (atMatch) {
    return { title: atMatch[1].trim(), company: atMatch[2].trim() }
  }

  // "Senior Engineer - Google - London" (Indeed, Glassdoor)
  // Split on " - " (with spaces) to avoid splitting hyphenated titles
  const dashParts = raw.split(/\s+-\s+/)
  if (dashParts.length >= 2) {
    return { title: dashParts[0].trim(), company: dashParts[1].trim() }
  }

  // Couldn't split — only use it if it looks like a real job title (not a generic page name)
  const genericPageTitles = /^(search|jobs?|careers?|find jobs?|home|dashboard|results?)$/i
  if (genericPageTitles.test(raw)) return null
  return { title: raw, company: null }
}

// ── Layer 3: DOM helpers ───────────────────────────────────────

function q(selector) {
  return document.querySelector(selector)?.textContent?.trim() || null
}

function qAttr(selector, attr) {
  return document.querySelector(selector)?.getAttribute(attr)?.trim() || null
}

function metaContent(nameOrProp) {
  return (
    document.querySelector(`meta[property="${nameOrProp}"]`)?.content?.trim() ||
    document.querySelector(`meta[name="${nameOrProp}"]`)?.content?.trim() ||
    null
  )
}

// ── Site-specific DOM scrapers ─────────────────────────────────

function scrapeLinkedIn() {
  const sd = getStructuredData()

  // ── Debug dump — paste the console output and share it ─────
  const dump = {
    url: location.href,
    structuredData: sd,
    h1s: [...document.querySelectorAll('h1')].map(el => ({
      text: el.textContent.trim().slice(0, 120),
      cls: el.className.slice(0, 120)
    })),
    h2s: [...document.querySelectorAll('h2')].map(el => ({
      text: el.textContent.trim().slice(0, 120),
      cls: el.className.slice(0, 120)
    })),
    companyLinks: [...document.querySelectorAll('a[href*="/company/"]')].map(a => ({
      text: a.textContent.trim().slice(0, 80),
      ariaLabel: a.getAttribute('aria-label')?.slice(0, 80),
      cls: a.className.slice(0, 80)
    })),
    topPanelHTML: (
      document.querySelector('.jobs-details') ||
      document.querySelector('.jobs-search__right-rail') ||
      document.querySelector('[class*="job-details"]')
    )?.innerHTML?.slice(0, 500) || '(panel not found)'
  }
  console.log('[Job Tracker] h1s found:', dump.h1s.length, JSON.stringify(dump.h1s))
  console.log('[Job Tracker] h2s found:', dump.h2s.length, JSON.stringify(dump.h2s))
  console.log('[Job Tracker] company links found:', dump.companyLinks.length, JSON.stringify(dump.companyLinks))
  console.log('[Job Tracker] panel HTML (first 500):', dump.topPanelHTML)
  // ────────────────────────────────────────────────────────────

  if (sd?.title || sd?.company) {
    return {
      source: 'LinkedIn',
      url: location.href,
      title: sd.title,
      company: sd.company,
      location: sd.location,
      description: sd.description
    }
  }

  // Panels LinkedIn uses on the search page right-rail
  const panelSelectors = [
    '.jobs-details__main-content',
    '.jobs-details',
    '.jobs-search__right-rail',
    '.jobs-search__job-details--container',
    '[class*="jobs-details"]'
  ]

  function qInPanels(selector) {
    for (const ps of panelSelectors) {
      const text = document.querySelector(`${ps} ${selector}`)?.textContent?.trim()
      if (text) return text
    }
    return null
  }

  // Title: try every heading in the panel, then page-wide
  const titleFromPanel =
    qInPanels('h1') ||
    qInPanels('h2') ||
    qInPanels('[class*="title"]') ||
    qInPanels('[class*="job-title"]')

  // Company: any /company/ link with visible text or aria-label, in panel first
  function companyFromLinks() {
    const panelEl = panelSelectors.map(s => document.querySelector(s)).find(Boolean) || document.body
    for (const a of panelEl.querySelectorAll('a[href*="/company/"]')) {
      const text = a.textContent.trim() || a.getAttribute('aria-label')?.trim()
      if (text && text.length > 1 && text.length < 120) return text
    }
    // Fallback: page-wide (skip any that look like nav items)
    for (const a of document.querySelectorAll('a[href*="/company/"]')) {
      const text = a.textContent.trim() || a.getAttribute('aria-label')?.trim()
      if (text && text.length > 1 && text.length < 120) return text
    }
    return null
  }

  // Location: subtitle spans near the job title
  const locationFromPanel =
    qInPanels('[class*="bullet"]') ||
    qInPanels('[class*="location"]') ||
    qInPanels('[class*="workplace"]')

  // Page title fallback — filter LinkedIn's generic search-page titles
  const genericTitles = new Set(['Search all Jobs', 'Jobs', 'LinkedIn Jobs', 'LinkedIn', 'Feed'])
  const pt = parsePageTitle()
  const ptTitle = pt?.title && !genericTitles.has(pt.title) ? pt.title : null

  return {
    source: 'LinkedIn',
    url: location.href,
    title: titleFromPanel || ptTitle,
    company: companyFromLinks() || pt?.company,
    location: locationFromPanel || sd?.location,
    description: sd?.description
  }
}

function scrapeIndeed() {
  const sd = getStructuredData()
  const pt = !sd?.title || !sd?.company ? parsePageTitle() : null
  return {
    source: 'Indeed',
    url: location.href,
    title:
      sd?.title ||
      pt?.title ||
      q('[data-testid="jobsearch-JobInfoHeader-title"]') ||
      q('h1.jobsearch-JobInfoHeader-title') ||
      q('[class*="jobTitle"] h1') ||
      q('h1'),
    company:
      sd?.company ||
      pt?.company ||
      q('[data-testid="inlineHeader-companyName"] a') ||
      q('[data-testid="inlineHeader-companyName"]') ||
      q('[class*="companyName"]'),
    location:
      sd?.location ||
      q('[data-testid="job-location"]') ||
      q('[class*="companyLocation"]') ||
      q('[class*="location"]'),
    description:
      sd?.description ||
      q('#jobDescriptionText')
  }
}

function scrapeGlassdoor() {
  const sd = getStructuredData()
  const pt = !sd?.title || !sd?.company ? parsePageTitle() : null
  return {
    source: 'Glassdoor',
    url: location.href,
    title:
      sd?.title ||
      pt?.title ||
      q('[data-test="job-title"]') ||
      q('[class*="JobDetails_jobTitle"]') ||
      q('h1'),
    company:
      sd?.company ||
      pt?.company ||
      q('[data-test="employer-name"]') ||
      q('[class*="EmployerProfile_employerName"]') ||
      q('[class*="employer-name"]'),
    location:
      sd?.location ||
      q('[data-test="location"]') ||
      q('[class*="JobDetails_location"]'),
    description: sd?.description
  }
}

function scrapeLever() {
  const sd = getStructuredData()
  const slug = location.pathname.split('/')[1] || ''
  const slugLabel = slug
    ? slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, ' ')
    : null
  return {
    source: 'Lever',
    url: location.href,
    title:
      sd?.title ||
      q('.posting-headline h2') ||
      q('[data-qa="posting-name"]') ||
      q('h2'),
    company:
      sd?.company ||
      qAttr('.main-header-logo img', 'alt') ||
      q('.company-name') ||
      slugLabel,
    location:
      sd?.location ||
      q('.location') ||
      q('[data-qa="location"]'),
    description:
      sd?.description ||
      q('.posting-description')
  }
}

function scrapeGreenhouse() {
  const sd = getStructuredData()
  const slug = location.pathname.split('/')[1] || ''
  const slugLabel = slug
    ? slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, ' ')
    : null
  return {
    source: 'Greenhouse',
    url: location.href,
    title:
      sd?.title ||
      q('h1.app-title') ||
      q('[class*="jobTitle"]') ||
      q('h1'),
    company:
      sd?.company ||
      q('.company-name') ||
      q('#header .company-name') ||
      slugLabel,
    location: sd?.location || q('.location'),
    description: sd?.description
  }
}

function scrapeWorkday() {
  const sd = getStructuredData()
  return {
    source: 'Workday',
    url: location.href,
    title:
      sd?.title ||
      q('[data-automation-id="jobPostingHeader"]'),
    company:
      sd?.company ||
      qAttr('[data-automation-id="logo"] img', 'alt') ||
      qAttr('img[class*="logo"]', 'alt') ||
      metaContent('og:site_name'),
    location:
      sd?.location ||
      q('[data-automation-id="locations"]'),
    description: sd?.description
  }
}

function scrapeReed() {
  const sd = getStructuredData()
  const pt = !sd?.title ? parsePageTitle() : null
  return {
    source: 'Reed',
    url: location.href,
    title:
      sd?.title ||
      pt?.title ||
      q('h1[itemprop="title"]') ||
      q('.job-header h1') ||
      q('h1'),
    company:
      sd?.company ||
      q('[itemprop="hiringOrganization"] [itemprop="name"]') ||
      q('.job-header__company'),
    location:
      sd?.location ||
      q('[itemprop="addressLocality"]') ||
      q('.job-header__location'),
    description: sd?.description
  }
}

function scrapeTotalJobs() {
  const sd = getStructuredData()
  const pt = !sd?.title ? parsePageTitle() : null
  return {
    source: 'TotalJobs',
    url: location.href,
    title:
      sd?.title ||
      pt?.title ||
      q('h1.job-title') ||
      q('h1'),
    company:
      sd?.company ||
      q('.companyInfo-name') ||
      q('[data-at="job-company"]'),
    location:
      sd?.location ||
      q('.job-location') ||
      q('[data-at="job-location"]'),
    description: sd?.description
  }
}

// Generic — runs on any site not matched above.
// Tries structured data, then page title, then common patterns.
function scrapeGeneric() {
  const sd = getStructuredData()
  const pt = parsePageTitle()

  // If structured data gave us something useful, use it
  if (sd?.title || sd?.company) {
    return {
      source: null,
      url: location.href,
      title: sd.title || pt?.title || null,
      company: sd.company || pt?.company || null,
      location: sd.location,
      description: sd.description
    }
  }

  // Try common class-based patterns before falling back to page title
  const titleFromDOM =
    q('[class*="job-title"] h1') ||
    q('[class*="jobTitle"] h1') ||
    q('[class*="posting-title"] h1') ||
    q('h1[class*="title"]') ||
    q('h1')

  const companyFromDOM =
    q('[class*="company-name"]') ||
    q('[class*="companyName"]') ||
    q('[class*="employer-name"]') ||
    q('[itemprop="name"]') ||
    metaContent('og:site_name')

  return {
    source: null,
    url: location.href,
    title: pt?.title || titleFromDOM,
    company: pt?.company || companyFromDOM,
    location: null,
    description: null
  }
}

// ── Router ─────────────────────────────────────────────────────

function scrapeCurrentPage() {
  const host = location.hostname
  try {
    if (host.includes('linkedin.com')) return scrapeLinkedIn()
    if (host.includes('indeed.com')) return scrapeIndeed()
    if (host.includes('glassdoor.com') || host.includes('glassdoor.co.uk')) return scrapeGlassdoor()
    if (host.includes('lever.co')) return scrapeLever()
    if (host.includes('greenhouse.io')) return scrapeGreenhouse()
    if (host.includes('myworkdayjobs.com')) return scrapeWorkday()
    if (host.includes('reed.co.uk')) return scrapeReed()
    if (host.includes('totaljobs.com') || host.includes('cwjobs.co.uk')) return scrapeTotalJobs()
  } catch { /* fall through to generic */ }
  return scrapeGeneric()
}

// ── Message handler ────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'GET_JOB_DATA') {
    sendResponse(scrapeCurrentPage())
  }
  return false
})
