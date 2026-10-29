/**
 * Content Script (Injected into Google Search & LinkedIn)
 * Responsible for DOM scraping, Regex email extraction, dynamic scroll observer,
 * and forwarding extracted profiles to background service worker.
 */

(function () {
  'use strict';

  console.log('[Lead Extractor] Content script active on:', window.location.href);

  const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi;

  // Configuration options cached from storage
  let config = {
    generateEmailPattern: true,
    defaultEmailDomain: '',
    autoScrapeOnScroll: true
  };

  // Sync settings
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['settings'], (res) => {
      if (res.settings) config = { ...config, ...res.settings };
    });
  }

  // Validate and clean company names
  function cleanCompanyName(company) {
    if (!company) return 'N/A';
    const trimmed = company.trim();
    // Reject if too short (e.g. "Ma", "Co") or matches generic non-company noise
    if (trimmed.length < 3 || /^(co|company|profile|linkedin|technology|tech)$/i.test(trimmed)) {
      return 'N/A';
    }
    return trimmed;
  }

  // Generate clean email prediction using verified company
  function generateEmail(name, company) {
    if (!name) return 'N/A';
    const validCompany = cleanCompanyName(company);
    if (validCompany === 'N/A') return 'N/A';

    const cleanParts = name.trim().toLowerCase().split(/\s+/);
    if (cleanParts.length === 0) return 'N/A';
    const first = cleanParts[0].replace(/[^a-z]/g, '');
    const last = cleanParts.length > 1 ? cleanParts[cleanParts.length - 1].replace(/[^a-z]/g, '') : '';
    
    let domain = config.defaultEmailDomain;
    if (!domain) {
      const cleanCompany = validCompany.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (cleanCompany.length > 2) {
        domain = cleanCompany + '.com';
      }
    }
    if (!domain || domain === 'company.com') return 'N/A';

    return first && last ? `${first}.${last}@${domain}` : `${first}@${domain}`;
  }

  /**
   * Advanced multi-tier company extraction with strict validation
   */
  function extractCompanyFromText(text, headerText, card) {
    const snippetElem = card.querySelector('.VwiC3b, .IsZvec, [data-sncf]');
    const snippetText = snippetElem ? snippetElem.innerText : text;

    // 1. Look for explicit patterns like "at [Company]" or "@ [Company]"
    const atMatch = snippetText.match(/(?:at|@)\s+([A-Z0-9][A-Za-z0-9\s,\.\-]+?(?:Pvt|Ltd|LLC|Inc|Technologies|Software|Solutions|Services|Group|Corp|ASBL|Enmovil|Zessta|iSwitch)?)/i);
    if (atMatch && atMatch[1]) {
      let comp = atMatch[1].trim().split('\n')[0];
      comp = comp.replace(/[,–—\-].*$/, '').trim();
      const validated = cleanCompanyName(comp);
      if (validated !== 'N/A') return validated;
    }

    // 2. Scan lines in snippet for corporate keywords
    const lines = snippetText.split('\n');
    for (let line of lines) {
      const cleanLine = line.trim();
      if (cleanLine.includes('http') || cleanLine.length < 3 || cleanLine.length > 45) continue;
      
      if (
        cleanLine.includes('Pvt') || 
        cleanLine.includes('Ltd') || 
        cleanLine.includes('LLC') || 
        cleanLine.includes('Inc') || 
        cleanLine.includes('Technologies') || 
        cleanLine.includes('Solutions') ||
        cleanLine.includes('Services')
      ) {
        let cleaned = cleanLine.replace(/[,–—\-].*$/, '').trim();
        const validated = cleanCompanyName(cleaned);
        if (validated !== 'N/A') return validated;
      }
    }

    return 'N/A';
  }

  /**
   * 1. Google Search Extraction Logic
   */
  function scrapeGoogleSearch() {
    const leads = [];
    const resultCards = document.querySelectorAll('.g, .MjjYud, div[data-hveid]');
    
    resultCards.forEach(card => {
      const text = card.innerText || '';
      const html = card.innerHTML || '';
      
      const linkElem = card.querySelector('a[href*="linkedin.com/in/"]');
      const linkedinUrl = linkElem ? linkElem.href.split('?')[0] : (html.match(/https:\/\/[a-z]{2,3}\.linkedin\.com\/in\/[^"?#\s]+/i)?.[0] || '');

      if (!linkedinUrl && !text.toLowerCase().includes('linkedin')) return;

      const titleElem = card.querySelector('h3');
      const headerText = titleElem ? titleElem.innerText : '';

      let name = '';
      let title = '';
      let company = 'N/A';

      if (headerText) {
        const cleanHeader = headerText.replace(/\|.*LinkedIn.*/i, '').trim();
        const parts = cleanHeader.split(/[-|–—]/).map(p => p.trim());
        
        if (parts.length >= 1) {
          name = parts[0].replace(/\|.*$/, '').trim();
        }
        
        for (let i = 1; i < parts.length; i++) {
          let part = parts[i];
          if (part.includes(' @ ')) {
            const subParts = part.split(' @ ');
            if (!title) title = subParts[0].trim();
            if (cleanCompanyName(subParts[1]) !== 'N/A') company = cleanCompanyName(subParts[1]);
          } else if (part.toLowerCase().includes(' at ')) {
            const subParts = part.split(/at\s+/i);
            if (!title) title = subParts[0].trim();
            if (cleanCompanyName(subParts[1]) !== 'N/A') company = cleanCompanyName(subParts[1]);
          } else {
            if (!title) title = part;
            else if (company === 'N/A') company = cleanCompanyName(part);
          }
        }
      }

      // If company is still invalid/N/A, invoke advanced scanner
      if (company === 'N/A') {
        company = extractCompanyFromText(text, headerText, card);
      }

      // Clean trailing locations
      if (company !== 'N/A') {
        company = company.replace(/\s+(Hyderabad|Bengaluru|Mumbai|Delhi|India|Area).*$/i, '').trim();
        company = company.replace(/[.,;–—-]+$/, '').trim();
        company = cleanCompanyName(company);
      }

      const emails = text.match(EMAIL_REGEX) || [];
      let email = emails[0] || '';
      let emailStatus = email ? 'found' : 'unknown';

      if (!email && name && config.generateEmailPattern) {
        email = generateEmail(name, company);
        emailStatus = email !== 'N/A' ? 'generated' : 'unknown';
      }

      if (name && name.length < 50 && !name.toLowerCase().includes('linkedin')) {
        leads.push({
          id: 'lead_g_' + Math.random().toString(36).substring(2, 9),
          name: name,
          company: company,
          title: title || 'Professional',
          linkedinUrl: linkedinUrl || 'https://www.linkedin.com',
          email: email || 'N/A',
          emailStatus: emailStatus,
          sourceUrl: window.location.href,
          sourceType: 'google',
          timestamp: new Date().toLocaleTimeString(),
          snippet: text.substring(0, 140) + '...'
        });
      }
    });

    return leads;
  }

  /**
   * 2. LinkedIn Scraping Logic
   */
  function scrapeLinkedIn() {
    const leads = [];
    const cards = document.querySelectorAll('.reusable-search__result-container, .entity-result, .search-result__info');

    cards.forEach(card => {
      const text = card.innerText || '';
      const linkElem = card.querySelector('a[href*="/in/"]');
      const linkedinUrl = linkElem ? linkElem.href.split('?')[0] : '';

      const nameElem = card.querySelector('.actor-name, .entity-result__title-text a, span[aria-hidden="true"]');
      const name = nameElem ? nameElem.innerText.trim() : '';

      const headlineElem = card.querySelector('.entity-result__primary-subtitle, .search-result__snippet');
      const headline = headlineElem ? headlineElem.innerText.trim() : '';

      let title = headline;
      let company = 'N/A';
      if (headline.includes(' @ ')) {
        const hParts = headline.split(' @ ');
        title = hParts[0].trim();
        company = cleanCompanyName(hParts[1]);
      } else if (headline.toLowerCase().includes(' at ')) {
        const hParts = headline.split(/at\s+/i);
        title = hParts[0].trim();
        company = cleanCompanyName(hParts[1]);
      }

      if (company === 'N/A') {
        company = extractCompanyFromText(text, name, card);
      }

      const emails = text.match(EMAIL_REGEX) || [];
      let email = emails[0] || '';
      let emailStatus = email ? 'found' : 'unknown';

      if (!email && name && config.generateEmailPattern) {
        email = generateEmail(name, company);
        emailStatus = email !== 'N/A' ? 'generated' : 'unknown';
      }

      if (name && linkedinUrl) {
        leads.push({
          id: 'lead_li_' + Math.random().toString(36).substring(2, 9),
          name,
          company,
          title: title || 'Professional',
          linkedinUrl,
          email: email || 'N/A',
          emailStatus,
          sourceUrl: window.location.href,
          sourceType: 'linkedin',
          timestamp: new Date().toLocaleTimeString(),
          snippet: text.substring(0, 140) + '...'
        });
      }
    });

    return leads;
  }

  // Master execution runner
  function runScraper() {
    let scraped = [];
    const host = window.location.hostname;
    
    if (host.includes('google.com')) {
      scraped = scrapeGoogleSearch();
    } else if (host.includes('linkedin.com')) {
      scraped = scrapeLinkedIn();
    }

    if (scraped.length > 0 && typeof chrome !== 'undefined' && chrome.runtime) {
      chrome.runtime.sendMessage({
        type: 'LEADS_EXTRACTED',
        leads: scraped
      });
    }

    return scraped;
  }

  // Execute initial scrape
  setTimeout(runScraper, 1500);

  // MutationObserver for dynamic single page application loading / infinite scroll
  let timeoutId = null;
  const observer = new MutationObserver(() => {
    if (!config.autoScrapeOnScroll) return;
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      runScraper();
    }, 2000);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Listen for manual extraction trigger from popup
  if (typeof chrome !== 'undefined' && chrome.runtime) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.type === 'SCRAPE_NOW') {
        const results = runScraper();
        sendResponse({ success: true, count: results.length, leads: results });
      }
    });
  }
})();