# Chrome Extension (Manifest V3) - Lead & Contact Extractor

A high-performance Manifest V3 Chrome Extension that parses Google Search results and LinkedIn search/profile pages to extract professional contact records, including:
- Employee Name
- Company Name
- Job Title
- LinkedIn Profile URL
- Email Address (scrapes visible emails via Regex & generates predicted email fallback)

## 🚀 How to Install in Chrome / Brave / Edge

1. Click **"Download Extension (.zip)"** in the top bar of this web app.
2. Unzip the downloaded file to a folder on your computer.
3. Open your browser and navigate to:
   - Chrome / Brave: `chrome://extensions`
   - Edge: `edge://extensions`
4. Enable **Developer mode** toggle in the top-right corner.
5. Click **"Load unpacked"** and select the unzipped directory.
6. Pin the **Lead Extractor** extension icon to your browser toolbar!

## 🛠️ File Architecture
- `manifest.json` - Manifest V3 configuration, declarations, and host permissions.
- `background.js` - Service Worker managing lead storage state & badge counts.
- `content.js` - Scraper script injected into `google.com/search*` and `linkedin.com/*`. Uses `MutationObserver` for dynamic infinite scroll.
- `popup.html` & `popup.js` - Extension popup UI with search filter, manual scrape trigger, and CSV export.
- `options.html` & `options.js` - Config settings for pattern generators and auto-scroll observers.
"# lead-extension" 
"# lead-extension" 
