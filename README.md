# AI Outreach Assistant — Chrome Extension

Generate personalized LinkedIn job outreach messages with one click.
Detects job title, company, and recruiter from the page, predicts a recruiter
email, and produces an editable AI message ready to copy and send.

---

## File Structure

```
ai-outreach-assistant/
├── manifest.json        Chrome extension config (MV3)
├── content.js           Injected into LinkedIn job pages
├── background.js        Service worker — mock API calls
├── panel.css            Styles for the injected floating button + panel
├── popup.html           Toolbar popup UI
├── popup.js             Popup logic
├── create_icons.py      Generates icons/icon{16,48,128}.png
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

---

## Installation (Developer Mode)

### Step 1 — Generate icons
```bash
python create_icons.py
```
This creates `icons/icon16.png`, `icons/icon48.png`, `icons/icon128.png`.
(LinkedIn blue solid squares — no dependencies required.)

### Step 2 — Open Chrome Extensions page
Open Chrome and navigate to:
```
chrome://extensions/
```

### Step 3 — Enable Developer Mode
Toggle the **Developer mode** switch in the **top-right corner** of the page.

### Step 4 — Load the extension
Click **"Load unpacked"** → select the `ai-outreach-assistant/` folder.

The extension icon (✉) appears in your Chrome toolbar.

### Step 5 — Test it
1. Go to any LinkedIn job posting, e.g.:
   `https://www.linkedin.com/jobs/view/XXXXXXX`
2. Wait ~2 seconds for the page to fully load.
3. A blue **"✉ Generate Outreach"** button appears in the bottom-right corner.
4. Click it → the panel slides in from the right.
5. Job details appear instantly; email + message load in ~1 second.

---

## How It Works

| Stage | What happens |
|-------|-------------|
| Page load | `content.js` is injected automatically on any `linkedin.com/jobs/*` URL |
| Button click | Job title, company, recruiter extracted from the DOM |
| API calls | `background.js` generates a predicted email + AI message (mock) |
| Panel | Editable message, copy buttons, regenerate — all in the side panel |

---

## Replacing Mock APIs with Real Ones

### Email Lookup — Hunter.io
```js
// background.js → mockFindEmail()
const res  = await fetch(
  `https://api.hunter.io/v2/email-finder?domain=${domain}&first_name=${first}&last_name=${last}&api_key=YOUR_KEY`
);
const data = await res.json();
return data.data.email;
```

### AI Message — OpenAI
```js
// background.js → mockGenerateMessage()
const res = await fetch('https://api.openai.com/v1/chat/completions', {
  method:  'POST',
  headers: { 'Authorization': `Bearer YOUR_KEY`, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    model:    'gpt-4o',
    messages: [
      { role: 'system', content: 'You write short, warm, professional LinkedIn outreach messages.' },
      { role: 'user',   content: `Job: ${jobTitle} at ${company}. Recruiter: ${recruiter}.` },
    ],
    max_tokens: 250,
  }),
});
const data = await res.json();
return data.choices[0].message.content;
```

### AI Message — Anthropic Claude
```js
const res = await fetch('https://api.anthropic.com/v1/messages', {
  method:  'POST',
  headers: {
    'x-api-key':         'YOUR_KEY',
    'anthropic-version': '2023-06-01',
    'content-type':      'application/json',
  },
  body: JSON.stringify({
    model:      'claude-sonnet-4-6',
    max_tokens: 300,
    messages:   [{ role: 'user', content: `Write a short LinkedIn outreach for ${jobTitle} at ${company}. Recruiter: ${recruiter}.` }],
  }),
});
const data = await res.json();
return data.content[0].text;
```

> Store API keys in `chrome.storage.local` — never hardcode them.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Button doesn't appear | Reload the LinkedIn page; wait 3s for the SPA to load |
| "Unknown Position" extracted | LinkedIn changed DOM classes — check console for selector hits |
| Panel slides in but email is blank | Background service worker sleeping — click the button again |
| Extension icon missing | Reload the extension at `chrome://extensions/` |
