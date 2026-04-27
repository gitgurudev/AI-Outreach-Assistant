// content.js — Injected into https://www.linkedin.com/jobs/*
// Responsibilities: extract job data, inject floating button, render panel.

// ── DOM Selector Fallbacks ────────────────────────────────────────
// LinkedIn changes class names frequently; multiple fallbacks keep this robust.
const SELECTORS = {
  jobTitle: [
    'h1.job-details-jobs-unified-top-card__job-title',
    '.job-details-jobs-unified-top-card__job-title h1',
    'h1.jobs-unified-top-card__job-title',
    '.jobs-details-top-card__job-title',
    '.job-details__job-title',
    'h1[class*="job-title"]',
    '.jobs-details-top-card h1',
    'h1',
  ],
  company: [
    '.job-details-jobs-unified-top-card__company-name a',
    '.job-details-jobs-unified-top-card__primary-description-without-tagline a',
    '.jobs-unified-top-card__company-name a',
    '.jobs-details-top-card__company-info a',
    '[class*="company-name"] a',
    '[class*="topcard__org-name-link"]',
  ],
  recruiter: [
    '.hirer-card__hirer-information .app-aware-link',
    '.jobs-poster__name',
    '.hiring-team-module__hiring-manager-name',
    '.hirer-card__hirer-information strong',
    '[class*="hirer"] .app-aware-link',
    '[class*="hiring-manager"] a',
    '[data-test-app-aware-link] span[aria-hidden="true"]',
  ],
};

const BTN_ID   = 'aoa-floating-btn';
const PANEL_ID = 'aoa-panel';

// ── State ─────────────────────────────────────────────────────────
let currentJob = null;

// ── Utility: first matching selector ─────────────────────────────
function queryFirst(selectors) {
  for (const sel of selectors) {
    const el = document.querySelector(sel);
    if (el?.innerText?.trim()) return el.innerText.trim();
  }
  return null;
}

// ── Extract job details from the LinkedIn DOM ─────────────────────
function extractJob() {
  return {
    jobTitle:  queryFirst(SELECTORS.jobTitle)  || 'Unknown Position',
    company:   queryFirst(SELECTORS.company)   || 'Unknown Company',
    recruiter: queryFirst(SELECTORS.recruiter) || 'Hiring Manager',
    url:       location.href,
  };
}

// ── Inject the floating trigger button ───────────────────────────
function injectButton() {
  if (document.getElementById(BTN_ID)) return; // already there

  const btn   = document.createElement('button');
  btn.id      = BTN_ID;
  btn.innerHTML = '✉&nbsp; Generate Outreach';
  btn.title   = 'AI Outreach Assistant';
  btn.addEventListener('click', handleGenerate);
  document.body.appendChild(btn);
}

// ── Main handler: extract → show panel → call APIs ───────────────
async function handleGenerate() {
  const btn = document.getElementById(BTN_ID);
  if (btn) { btn.disabled = true; btn.textContent = '⏳ Analyzing…'; }

  currentJob = extractJob();
  await renderPanel(currentJob);     // show panel immediately with job data

  // Fetch email + message in parallel via background service worker
  const [emailRes, msgRes] = await Promise.all([
    chrome.runtime.sendMessage({
      type:          'FIND_EMAIL',
      recruiterName: currentJob.recruiter,
      company:       currentJob.company,
    }),
    chrome.runtime.sendMessage({
      type:      'GENERATE_MESSAGE',
      jobTitle:  currentJob.jobTitle,
      company:   currentJob.company,
      recruiter: currentJob.recruiter,
    }),
  ]);

  fillPanelResults(emailRes?.email, msgRes?.message);

  if (btn) { btn.disabled = false; btn.innerHTML = '✉&nbsp; Generate Outreach'; }
}

// ── Build panel HTML ──────────────────────────────────────────────
async function renderPanel(job) {
  removePanel();

  const panel = document.createElement('div');
  panel.id    = PANEL_ID;
  // Check AI mode from storage to show badge in header
  const { aiEnabled = false, openaiKey = '' } =
    await chrome.storage.local.get(['aiEnabled', 'openaiKey']);
  const usingReal = aiEnabled && !!openaiKey;

  panel.innerHTML = `
    <div class="aoa-header">
      <div class="aoa-header-left">
        <span class="aoa-logo">✉</span>
        <span class="aoa-title">AI Outreach Assistant</span>
      </div>
      <span class="aoa-mode-tag ${usingReal ? 'aoa-mode-real' : 'aoa-mode-mock'}">
        ${usingReal ? 'GPT-4o' : 'Mock'}
      </span>
      <button id="aoa-close" class="aoa-close-btn" title="Close">✕</button>
    </div>

    <div class="aoa-body">

      <!-- Job Details -->
      <div class="aoa-section">
        <div class="aoa-section-label">Extracted Job Details</div>
        <div class="aoa-field">
          <span class="aoa-fkey">Role</span>
          <span class="aoa-fval">${esc(job.jobTitle)}</span>
        </div>
        <div class="aoa-field">
          <span class="aoa-fkey">Company</span>
          <span class="aoa-fval">${esc(job.company)}</span>
        </div>
        <div class="aoa-field">
          <span class="aoa-fkey">Contact</span>
          <span class="aoa-fval">${esc(job.recruiter)}</span>
        </div>
      </div>

      <!-- Email -->
      <div class="aoa-section">
        <div class="aoa-section-label">Recruiter Email</div>
        <div class="aoa-copy-row">
          <span class="aoa-email-val" id="aoa-email">
            <em class="aoa-muted">Finding…</em>
          </span>
          <button class="aoa-btn-sm" id="aoa-copy-email" disabled>Copy</button>
        </div>
        <p class="aoa-note">⚠ Predicted format — verify before sending</p>
      </div>

      <!-- Message -->
      <div class="aoa-section aoa-section-flex">
        <div class="aoa-section-label">
          Outreach Message
          <button class="aoa-btn-outline" id="aoa-regen" disabled>↻ Regenerate</button>
        </div>
        <textarea id="aoa-msg" class="aoa-textarea"
          placeholder="Generating personalized message…" disabled></textarea>
        <div class="aoa-row-between">
          <span class="aoa-hint">Edit before sending ✎</span>
          <button class="aoa-btn-primary" id="aoa-copy-msg" disabled>Copy Message</button>
        </div>
      </div>

    </div><!-- /.aoa-body -->
  `;

  document.body.appendChild(panel);
  // Animate slide-in
  requestAnimationFrame(() => panel.classList.add('aoa-open'));

  // Events
  document.getElementById('aoa-close').addEventListener('click', removePanel);
  document.getElementById('aoa-regen').addEventListener('click', handleRegenerate);
  document.getElementById('aoa-copy-email').addEventListener('click',
    () => copyEl('aoa-email', 'aoa-copy-email'));
  document.getElementById('aoa-copy-msg').addEventListener('click',
    () => copyEl('aoa-msg', 'aoa-copy-msg', true));
}

// ── Populate panel with API results ──────────────────────────────
function fillPanelResults(email, message) {
  const emailEl    = document.getElementById('aoa-email');
  const msgEl      = document.getElementById('aoa-msg');
  const copyEmail  = document.getElementById('aoa-copy-email');
  const copyMsg    = document.getElementById('aoa-copy-msg');
  const regenBtn   = document.getElementById('aoa-regen');

  if (emailEl && email) {
    emailEl.textContent  = email;
    copyEmail.disabled   = false;
  }

  if (msgEl && message) {
    msgEl.value       = message;
    msgEl.disabled    = false;
    copyMsg.disabled  = false;
    regenBtn.disabled = false;
    autoResize(msgEl);
  }
}

// ── Regenerate message ────────────────────────────────────────────
async function handleRegenerate() {
  if (!currentJob) return;

  const btn   = document.getElementById('aoa-regen');
  const msgEl = document.getElementById('aoa-msg');

  btn.disabled    = true;
  btn.textContent = '⏳';
  if (msgEl) { msgEl.value = ''; msgEl.disabled = true; }

  const res = await chrome.runtime.sendMessage({
    type:      'GENERATE_MESSAGE',
    jobTitle:  currentJob.jobTitle,
    company:   currentJob.company,
    recruiter: currentJob.recruiter,
  });

  if (msgEl && res?.message) {
    msgEl.value    = res.message;
    msgEl.disabled = false;
    autoResize(msgEl);
    document.getElementById('aoa-copy-msg').disabled = false;
  }

  btn.disabled    = false;
  btn.textContent = '↻ Regenerate';
}

// ── Copy helper ───────────────────────────────────────────────────
function copyEl(id, btnId, isTextarea = false) {
  const el  = document.getElementById(id);
  const btn = document.getElementById(btnId);
  const txt = isTextarea ? el.value : el.textContent;

  navigator.clipboard.writeText(txt).then(() => {
    const orig    = btn.textContent;
    btn.textContent = '✓ Copied!';
    btn.classList.add('aoa-copied');
    setTimeout(() => {
      btn.textContent = orig;
      btn.classList.remove('aoa-copied');
    }, 2000);
  });
}

// ── Auto-resize textarea to content ──────────────────────────────
function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 300) + 'px';
}

// ── HTML escape ───────────────────────────────────────────────────
function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── Remove panel ──────────────────────────────────────────────────
function removePanel() {
  document.getElementById(PANEL_ID)?.remove();
}

// ── Listen for messages from popup ───────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'TRIGGER_PANEL') {
    handleGenerate();
    sendResponse({ ok: true });
  }

  if (msg.type === 'GET_JOB_INFO') {
    const job = currentJob || extractJob();
    sendResponse({ jobTitle: job.jobTitle, company: job.company });
  }

  return true;
});

// ── LinkedIn SPA navigation: re-inject on URL change ─────────────
let _lastUrl = location.href;
new MutationObserver(() => {
  if (location.href !== _lastUrl) {
    _lastUrl = location.href;
    removePanel();
    document.getElementById(BTN_ID)?.remove();
    // Re-check master switch before re-injecting
    chrome.storage.local.get('extEnabled').then(({ extEnabled = true }) => {
      if (extEnabled) setTimeout(injectButton, 2000);
    });
  }
}).observe(document.body, { childList: true, subtree: true });

// ── Storage watcher — instant react to popup toggle ──────────────
// Fires in content script whenever chrome.storage.local changes.
// No message passing needed; works even without page refresh.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local' || !('extEnabled' in changes)) return;
  const enabled = changes.extEnabled.newValue ?? true;
  if (enabled) {
    injectButton();
  } else {
    document.getElementById(BTN_ID)?.remove();
    removePanel();
  }
});

// ── Boot ──────────────────────────────────────────────────────────
async function boot() {
  const { extEnabled = true } = await chrome.storage.local.get('extEnabled');
  if (extEnabled) setTimeout(injectButton, 1500);
}
boot();
