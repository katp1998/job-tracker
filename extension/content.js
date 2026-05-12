'use strict'

function t(selector) {
  return document.querySelector(selector)?.textContent?.trim() || null
}

function attr(selector, attribute) {
  return document.querySelector(selector)?.getAttribute(attribute)?.trim() || null
}

function metaContent(nameOrProp) {
  return (
    document.querySelector(`meta[property="${nameOrProp}"]`)?.content?.trim() ||
    document.querySelector(`meta[name="${nameOrProp}"]`)?.content?.trim() ||
    null
  )
}

// ── Per-site scrapers ──────────────────────────────────────────

function scrapeLinkedIn() {
  return {
    source: 'LinkedIn',
    url: location.href,
    title:
      t('.job-details-jobs-unified-top-card__job-title h1') ||
      t('h1.t-24') ||
      t('[data-test-id="job-detail-title"]'),
    company:
      t('.job-details-jobs-unified-top-card__company-name a') ||
      t('.job-details-jobs-unified-top-card__company-name') ||
      t('.jobs-unified-top-card__company-name a'),
    location:
      t('.job-details-jobs-unified-top-card__bullet') ||
      t('.jobs-unified-top-card__bullet') ||
      t('.job-details-jobs-unified-top-card__primary-description-container .tvm__text')
  }
}

function scrapeIndeed() {
  return {
    source: 'Indeed',
    url: location.href,
    title:
      t('[data-testid="jobsearch-JobInfoHeader-title"]') ||
      t('h1.jobsearch-JobInfoHeader-title'),
    company:
      t('[data-testid="inlineHeader-companyName"] a') ||
      t('[data-testid="inlineHeader-companyName"]') ||
      t('.icl-u-lg-mr--sm'),
    location:
      t('[data-testid="job-location"]') ||
      t('.jobsearch-JobInfoHeader-locationName')
  }
}

function scrapeGlassdoor() {
  return {
    source: 'Glassdoor',
    url: location.href,
    title:
      t('[data-test="job-title"]') ||
      t('.JobDetails_jobTitle__Rw_gn') ||
      t('h1.job-title'),
    company:
      t('[data-test="employer-name"]') ||
      t('.EmployerProfile_employerName__Uga0y') ||
      t('.employer-name'),
    location:
      t('[data-test="location"]') ||
      t('.JobDetails_location__mSg5h') ||
      t('[data-test="job-location"]')
  }
}

function scrapeLever() {
  const pathParts = location.pathname.split('/')
  const slug = pathParts[1] || ''
  const slugLabel = slug
    ? slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, ' ')
    : null
  return {
    source: 'Lever',
    url: location.href,
    title:
      t('.posting-headline h2') ||
      t('h2.posting-title') ||
      t('[data-qa="posting-name"]'),
    company:
      attr('.main-header-logo img', 'alt') ||
      t('.company-name') ||
      slugLabel,
    location:
      t('.location') ||
      t('[data-qa="location"]') ||
      t('.sort-by-location .posting-category')
  }
}

function scrapeGreenhouse() {
  const pathParts = location.pathname.split('/')
  const slug = pathParts[1] || ''
  const slugLabel = slug
    ? slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, ' ')
    : null
  return {
    source: 'Greenhouse',
    url: location.href,
    title:
      t('h1.app-title') ||
      t('.posting h1') ||
      t('h1[class*="jobTitle"]'),
    company:
      t('.company-name') ||
      t('#header .company-name') ||
      t('[class*="companyName"]') ||
      slugLabel,
    location:
      t('.location') ||
      t('[class*="location"]')
  }
}

function scrapeWorkday() {
  return {
    source: 'Workday',
    url: location.href,
    title: t('[data-automation-id="jobPostingHeader"]'),
    company:
      attr('[data-automation-id="logo"] img', 'alt') ||
      attr('img[class*="logo"]', 'alt') ||
      metaContent('og:site_name'),
    location: t('[data-automation-id="locations"]')
  }
}

function scrapeReed() {
  return {
    source: 'Reed',
    url: location.href,
    title:
      t('h1[itemprop="title"]') ||
      t('.job-header h1') ||
      t('h1'),
    company:
      t('[itemprop="hiringOrganization"] [itemprop="name"]') ||
      t('.job-header__company') ||
      t('[class*="employer"]'),
    location:
      t('[itemprop="jobLocation"] [itemprop="addressLocality"]') ||
      t('.job-header__location') ||
      t('[data-qa="job-location"]')
  }
}

function scrapeTotalJobs() {
  return {
    source: 'TotalJobs',
    url: location.href,
    title:
      t('h1.job-title') ||
      t('[class*="jobTitle"] h1') ||
      t('h1'),
    company:
      t('.companyInfo-name') ||
      t('[class*="companyName"]') ||
      t('[data-at="job-company"]'),
    location:
      t('.job-location') ||
      t('[data-at="job-location"]') ||
      t('[class*="location"]')
  }
}

function scrapeGeneric() {
  return {
    source: null,
    url: location.href,
    title: null,
    company: metaContent('og:site_name') || metaContent('author'),
    location: null
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
  } catch {
    /* scraper error – fall through to generic */
  }
  return scrapeGeneric()
}

// ── Message handler ────────────────────────────────────────────

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'GET_JOB_DATA') {
    sendResponse(scrapeCurrentPage())
  }
  return false
})
