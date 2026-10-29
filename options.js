/**
 * Options page handler
 */
document.addEventListener('DOMContentLoaded', () => {
  const generateEmailPattern = document.getElementById('generateEmailPattern');
  const defaultEmailDomain = document.getElementById('defaultEmailDomain');
  const autoScrapeOnScroll = document.getElementById('autoScrapeOnScroll');
  const saveBtn = document.getElementById('saveBtn');
  const status = document.getElementById('status');

  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['settings'], (res) => {
      if (res.settings) {
        generateEmailPattern.checked = res.settings.generateEmailPattern !== false;
        defaultEmailDomain.value = res.settings.defaultEmailDomain || '';
        autoScrapeOnScroll.checked = res.settings.autoScrapeOnScroll !== false;
      }
    });
  }

  saveBtn.addEventListener('click', () => {
    const newSettings = {
      generateEmailPattern: generateEmailPattern.checked,
      defaultEmailDomain: defaultEmailDomain.value.trim(),
      autoScrapeOnScroll: autoScrapeOnScroll.checked
    };

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ settings: newSettings }, () => {
        status.textContent = 'Settings saved!';
        setTimeout(() => { status.textContent = ''; }, 2000);
      });
    } else {
      status.textContent = 'Settings saved (Demo)';
      setTimeout(() => { status.textContent = ''; }, 2000);
    }
  });
});
