/**
 * Extension Popup Logic (popup.js)
 * Manages UI rendering, search filter, CSV export trigger, and manual DOM scrape requests.
 */

document.addEventListener('DOMContentLoaded', () => {
  const leadsList = document.getElementById('leadsList');
  const leadCountBadge = document.getElementById('leadCountBadge');
  const scrapeBtn = document.getElementById('scrapeBtn');
  const exportCsvBtn = document.getElementById('exportCsvBtn');
  const clearBtn = document.getElementById('clearBtn');
  const searchInput = document.getElementById('searchInput');

  let currentLeads = [];

  // Load saved leads from extension storage
  function loadLeads() {
    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.get(['extractedLeads'], (result) => {
        currentLeads = result.extractedLeads || [];
        renderLeads(currentLeads);
      });
    }
  }

  // Render lead cards in popup list
  function renderLeads(leadsToRender) {
    const query = searchInput.value.toLowerCase().trim();
    const filtered = leadsToRender.filter(l => 
      l.name.toLowerCase().includes(query) ||
      l.company.toLowerCase().includes(query) ||
      l.title.toLowerCase().includes(query)
    );

    leadCountBadge.textContent = `${filtered.length} Leads`;

    if (filtered.length === 0) {
      leadsList.innerHTML = `
        <div class="empty-state">
          <p>No matching leads found.</p>
          <p style="font-size: 11px; margin-top: 4px; color: #94a3b8;">
            Try refreshing the page or search on Google/LinkedIn.
          </p>
        </div>
      `;
      return;
    }

    leadsList.innerHTML = filtered.map(lead => `
      <div class="lead-card">
        <div class="lead-header">
          <a href="${lead.linkedinUrl}" target="_blank" class="lead-name">
            ${escapeHtml(lead.name)} 🔗
          </a>
          <span style="font-size: 10px; color: #64748b; background: #f1f5f9; padding: 2px 5px; border-radius: 4px;">
            ${lead.sourceType}
          </span>
        </div>
        <div class="lead-title">${escapeHtml(lead.title)}</div>
        <div class="lead-company">${escapeHtml(lead.company)}</div>
        <div class="lead-email ${lead.emailStatus === 'generated' ? 'email-generated' : ''}">
          ${lead.emailStatus === 'generated' ? '⚡ Predicted: ' : '✉️ '}${escapeHtml(lead.email)}
        </div>
      </div>
    `).join('');
  }

  function escapeHtml(str) {
    return (str || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  // Handle Manual Scrape Trigger
  scrapeBtn.addEventListener('click', () => {
    scrapeBtn.textContent = '⏳ Scraping DOM...';
    scrapeBtn.disabled = true;

    if (typeof chrome !== 'undefined' && chrome.tabs) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0]) return;
        chrome.tabs.sendMessage(tabs[0].id, { type: 'SCRAPE_NOW' }, (response) => {
          setTimeout(() => {
            scrapeBtn.textContent = '⚡ Refresh & Scrape Page';
            scrapeBtn.disabled = false;
            loadLeads();
          }, 600);
        });
      });
    } else {
      setTimeout(() => {
        scrapeBtn.textContent = '⚡ Refresh & Scrape Page';
        scrapeBtn.disabled = false;
      }, 500);
    }
  });

  // Handle Export to CSV
  exportCsvBtn.addEventListener('click', () => {
    if (currentLeads.length === 0) {
      alert('No leads available to export.');
      return;
    }

    const headers = ['Name', 'Title', 'Company', 'Email', 'Email Status', 'LinkedIn URL', 'Source', 'Timestamp'];
    const rows = currentLeads.map(l => [
      `"${(l.name || '').replace(/"/g, '""')}"`,
      `"${(l.title || '').replace(/"/g, '""')}"`,
      `"${(l.company || '').replace(/"/g, '""')}"`,
      `"${(l.email || '').replace(/"/g, '""')}"`,
      `"${(l.emailStatus || '').replace(/"/g, '""')}"`,
      `"${(l.linkedinUrl || '').replace(/"/g, '""')}"`,
      `"${(l.sourceType || '').replace(/"/g, '""')}"`,
      `"${(l.timestamp || '').replace(/"/g, '""')}"`
    ]);

    const csvStr = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `leads_export_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });

  // Clear Leads
  clearBtn.addEventListener('click', () => {
    if (confirm('Clear all stored leads?')) {
      if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.sendMessage({ type: 'CLEAR_LEADS' }, () => {
          currentLeads = [];
          renderLeads([]);
        });
      }
    }
  });

  // Filter listener
  searchInput.addEventListener('input', () => {
    renderLeads(currentLeads);
  });

  loadLeads();
});
