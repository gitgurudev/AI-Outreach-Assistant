// popup.js — Extension toolbar popup logic

const statusEl  = document.getElementById('status');
const statusDot = document.getElementById('status-dot');
const statusTxt = document.getElementById('status-text');
const openBtn   = document.getElementById('open-btn');
const infoBox   = document.getElementById('info-box');
const infoTitle = document.getElementById('info-title');
const infoCo    = document.getElementById('info-company');

// ── On popup open: check if current tab is a LinkedIn job page ────
(async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) return setStatus(false, 'No active tab');

  const isJobPage = tab.url.includes('linkedin.com/jobs/');
  if (!isJobPage) return setStatus(false, 'Go to a LinkedIn job posting');

  setStatus(true, 'LinkedIn job page detected');
  openBtn.disabled = false;

  // Try to read already-extracted job details from the content script
  try {
    const res = await chrome.tabs.sendMessage(tab.id, { type: 'GET_JOB_INFO' });
    if (res?.jobTitle) {
      infoBox.style.display = 'block';
      infoTitle.textContent = res.jobTitle;
      infoCo.textContent    = res.company;
    }
  } catch {
    // Content script not yet ready — that's fine
  }
})();

// ── "Open Outreach Panel" click ───────────────────────────────────
openBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  try {
    // Ask the already-injected content script to trigger the panel
    await chrome.tabs.sendMessage(tab.id, { type: 'TRIGGER_PANEL' });
  } catch {
    // Fallback: inject a script directly if content script missed the page load
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func:   () => {
        const btn = document.getElementById('aoa-floating-btn');
        if (btn) btn.click();
      },
    });
  }

  window.close(); // Close popup after triggering
});

// ── Helpers ───────────────────────────────────────────────────────
function setStatus(active, message) {
  statusTxt.textContent = message;
  statusEl.className    = 'status ' + (active ? 'status-on'  : 'status-off');
  statusDot.className   = 'dot '    + (active ? 'dot-green'  : 'dot-gray');
}
