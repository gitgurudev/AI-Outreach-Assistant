// popup.js — Toolbar popup logic (v1.1)
// Handles: page detection, AI toggle, API key save/load, panel trigger.

// ── Element refs ──────────────────────────────────────────────────
const statusEl      = document.getElementById('status');
const statusDot     = document.getElementById('status-dot');
const statusTxt     = document.getElementById('status-text');
const openBtn       = document.getElementById('open-btn');
const infoBox       = document.getElementById('info-box');
const infoTitle     = document.getElementById('info-title');
const infoCo        = document.getElementById('info-company');
const aiBadge       = document.getElementById('ai-badge');
const aiBadgeText   = document.getElementById('ai-badge-text');
const aiBadgeTag    = document.getElementById('ai-badge-tag');
const settingsToggle= document.getElementById('settings-toggle');
const settingsBox   = document.getElementById('settings-box');
const aiToggle      = document.getElementById('ai-toggle');
const keyInput      = document.getElementById('key-input');
const keySave       = document.getElementById('key-save');
const keyStatus     = document.getElementById('key-status');
const extToggle     = document.getElementById('ext-toggle');
const masterTitle   = document.getElementById('master-title');
const masterSub     = document.getElementById('master-sub');

// ── Init: load saved settings + check current tab ─────────────────
(async () => {
  await loadSettings();
  await checkTab();
})();

// ── Master extension ON/OFF toggle ───────────────────────────────
extToggle.addEventListener('change', async () => {
  const enabled = extToggle.checked;
  await chrome.storage.local.set({ extEnabled: enabled });
  applyExtState(enabled);

  // Tell the active tab's content script to show or hide the button
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.url?.includes('linkedin.com/jobs/')) {
    chrome.tabs.sendMessage(tab.id, {
      type: 'SET_EXT_ENABLED', enabled,
    }).catch(() => {});
  }
});

function applyExtState(enabled) {
  extToggle.checked   = enabled;
  masterTitle.textContent = enabled ? 'Extension ON'  : 'Extension OFF';
  masterSub.textContent   = enabled ? 'Button visible on LinkedIn' : 'Button hidden on LinkedIn';
  document.body.classList.toggle('ext-off', !enabled);
}

// ── Load settings from chrome.storage.local ───────────────────────
async function loadSettings() {
  const { openaiKey = '', aiEnabled = false, extEnabled = true } =
    await chrome.storage.local.get(['openaiKey', 'aiEnabled', 'extEnabled']);

  // Master toggle (default ON)
  applyExtState(extEnabled);

  aiToggle.checked = aiEnabled;
  updateAiBadge(aiEnabled, !!openaiKey);

  if (openaiKey) {
    // Show masked key so user knows one is saved
    keyInput.placeholder = 'sk-…' + openaiKey.slice(-4);
    keyStatus.textContent = '✓ Key saved';
    keyStatus.className   = 'key-status has-key';
  }
}

// ── Save API key ──────────────────────────────────────────────────
keySave.addEventListener('click', async () => {
  const val = keyInput.value.trim();
  if (!val) return;

  if (!val.startsWith('sk-')) {
    keyStatus.textContent = '⚠ Key should start with sk-';
    keyStatus.className   = 'key-status';
    return;
  }

  await chrome.storage.local.set({ openaiKey: val });

  // Auto-enable AI when a key is first saved
  await chrome.storage.local.set({ aiEnabled: true });
  aiToggle.checked = true;
  updateAiBadge(true, true);

  keyInput.value        = '';
  keyInput.placeholder  = 'sk-…' + val.slice(-4);
  keyStatus.textContent = '✓ Key saved & AI enabled';
  keyStatus.className   = 'key-status has-key';

  keySave.textContent   = '✓ Saved';
  keySave.classList.add('saved');
  setTimeout(() => {
    keySave.textContent = 'Save';
    keySave.classList.remove('saved');
  }, 2000);
});

// ── AI toggle ─────────────────────────────────────────────────────
aiToggle.addEventListener('change', async () => {
  const { openaiKey = '' } = await chrome.storage.local.get('openaiKey');
  const enabled = aiToggle.checked;

  if (enabled && !openaiKey) {
    // Warn if no key but user tries to enable
    keyStatus.textContent = '⚠ Paste your OpenAI key first';
    keyStatus.className   = 'key-status';
    aiToggle.checked      = false;
    return;
  }

  await chrome.storage.local.set({ aiEnabled: enabled });
  updateAiBadge(enabled, !!openaiKey);
});

// ── Settings accordion ────────────────────────────────────────────
settingsToggle.addEventListener('click', () => {
  const open = settingsBox.classList.toggle('open');
  settingsToggle.classList.toggle('open', open);
});

// ── Page detection ────────────────────────────────────────────────
async function checkTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) return setPageStatus(false, 'No active tab');

  if (!tab.url.includes('linkedin.com/jobs/')) {
    return setPageStatus(false, 'Go to a LinkedIn job posting');
  }

  setPageStatus(true, 'LinkedIn job page detected');
  openBtn.disabled = false;

  // Ask content script for already-extracted job details
  try {
    const res = await chrome.tabs.sendMessage(tab.id, { type: 'GET_JOB_INFO' });
    if (res?.jobTitle) {
      infoBox.style.display = 'block';
      infoTitle.textContent = res.jobTitle;
      infoCo.textContent    = res.company;
    }
  } catch {
    // Content script may not be injected yet — normal on first load
  }
}

// ── Open panel in the active tab ──────────────────────────────────
openBtn.addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab) return;

  try {
    await chrome.tabs.sendMessage(tab.id, { type: 'TRIGGER_PANEL' });
  } catch {
    // Fallback: directly click the injected button via scripting
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func:   () => document.getElementById('aoa-floating-btn')?.click(),
    });
  }
  window.close();
});

// ── Helpers ───────────────────────────────────────────────────────
function setPageStatus(active, message) {
  statusTxt.textContent = message;
  statusEl.className    = 'status ' + (active ? 'status-on'  : 'status-off');
  statusDot.className   = 'dot '    + (active ? 'dot-green'  : 'dot-gray');
}

function updateAiBadge(enabled, hasKey) {
  if (enabled && hasKey) {
    aiBadge.className    = 'ai-badge ai-badge-on';
    aiBadgeText.textContent = 'GPT-4o Active';
    aiBadgeTag.textContent  = 'REAL AI';
    aiBadgeTag.className    = 'ai-badge-tag tag-real';
  } else {
    aiBadge.className    = 'ai-badge ai-badge-off';
    aiBadgeText.textContent = 'Mock Mode';
    aiBadgeTag.textContent  = 'MOCK';
    aiBadgeTag.className    = 'ai-badge-tag tag-mock';
  }
}
