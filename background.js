/**
 * Background Service Worker (Manifest V3)
 * Manages extension state, storage sync, badge updates, and message handling.
 */

// Initialize storage defaults on installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('[Lead Extractor] Extension installed successfully.');
  
  chrome.storage.local.get(['extractedLeads', 'settings'], (result) => {
    if (!result.extractedLeads) {
      chrome.storage.local.set({ extractedLeads: [] });
    }
    if (!result.settings) {
      chrome.storage.local.set({
        settings: {
          generateEmailPattern: true,
          defaultEmailDomain: '',
          autoScrapeOnScroll: true
        }
      });
    }
  });
});

// Listen for incoming messages from content scripts or popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'LEADS_EXTRACTED') {
    const newLeads = request.leads || [];
    
    // Merge new leads into storage avoiding duplicate LinkedIn URLs
    chrome.storage.local.get(['extractedLeads'], (result) => {
      const existing = result.extractedLeads || [];
      const urlMap = new Map(existing.map(item => [item.linkedinUrl || item.name, item]));
      
      let addedCount = 0;
      newLeads.forEach(lead => {
        const key = lead.linkedinUrl || lead.name;
        if (key && !urlMap.has(key)) {
          urlMap.set(key, lead);
          addedCount++;
        }
      });

      const updatedList = Array.from(urlMap.values());
      chrome.storage.local.set({ extractedLeads: updatedList }, () => {
        // Update Extension Badge count
        const countStr = updatedList.length > 0 ? String(updatedList.length) : '';
        chrome.action.setBadgeText({ text: countStr });
        chrome.action.setBadgeBackgroundColor({ color: '#2563EB' }); // Blue-600

        sendResponse({ success: true, count: updatedList.length, added: addedCount });
      });
    });
    return true; // Async sendResponse
  }

  if (request.type === 'GET_LEADS') {
    chrome.storage.local.get(['extractedLeads'], (result) => {
      sendResponse({ leads: result.extractedLeads || [] });
    });
    return true;
  }

  if (request.type === 'CLEAR_LEADS') {
    chrome.storage.local.set({ extractedLeads: [] }, () => {
      chrome.action.setBadgeText({ text: '' });
      sendResponse({ success: true });
    });
    return true;
  }
});
