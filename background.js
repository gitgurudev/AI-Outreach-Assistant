// background.js — MV3 Service Worker (v1.1)
// Routes FIND_EMAIL and GENERATE_MESSAGE requests.
// Uses real OpenAI API when aiEnabled=true and openaiKey is set,
// otherwise falls back to mock functions.

chrome.runtime.onInstalled.addListener(() => {
  console.log('[AOA] AI Outreach Assistant v1.1 installed.');
});

// ── Message Router ────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {

  if (msg.type === 'FIND_EMAIL') {
    // Email lookup is always mock (no free API without key)
    // Swap mockFindEmail() with Hunter.io if you have a key
    sendResponse({ email: mockFindEmail(msg.recruiterName, msg.company) });
    return true;
  }

  if (msg.type === 'GENERATE_MESSAGE') {
    // Async: check storage first, then decide real vs mock
    generateMessage(msg.jobTitle, msg.company, msg.recruiter)
      .then(message => sendResponse({ message }))
      .catch(err    => sendResponse({ message: mockGenerateMessage(msg.jobTitle, msg.company, msg.recruiter), error: err.message }));
    return true; // keep message channel open for async response
  }

  return true;
});

// ── Generate message: real OpenAI or mock ─────────────────────────
async function generateMessage(jobTitle, company, recruiter) {
  const { openaiKey = '', aiEnabled = false } =
    await chrome.storage.local.get(['openaiKey', 'aiEnabled']);

  if (aiEnabled && openaiKey) {
    return callOpenAI(openaiKey, jobTitle, company, recruiter);
  }

  return mockGenerateMessage(jobTitle, company, recruiter);
}

// ── Real: OpenAI GPT-4o ───────────────────────────────────────────
async function callOpenAI(apiKey, jobTitle, company, recruiter) {
  const firstName = recruiter?.trim().split(/\s+/)[0] || 'there';

  const prompt = `Write a short, warm, professional LinkedIn outreach message.
Job: ${jobTitle} at ${company}.
Recruiter first name: ${firstName}.
Rules: 3–4 short paragraphs, no fluff, end with a clear CTA, leave "[Your Name]" as a placeholder.`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type':  'application/json',
    },
    body: JSON.stringify({
      model:      'gpt-4o',
      max_tokens: 300,
      temperature: 0.75,
      messages: [
        { role: 'system', content: 'You write concise, personalized LinkedIn outreach messages for job seekers.' },
        { role: 'user',   content: prompt },
      ],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message || `OpenAI error ${res.status}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content?.trim() || mockGenerateMessage(jobTitle, company, recruiter);
}

// ── Mock: Email Finder ────────────────────────────────────────────
// Replace with Hunter.io: GET https://api.hunter.io/v2/email-finder
function mockFindEmail(recruiterName = '', company = '') {
  const domain = company
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '').trim()
    .split(/\s+/)
    .filter(w => !['inc','llc','ltd','corp','co','the','and','of'].includes(w))
    .join('').slice(0, 20) || 'company';

  const [first = 'hr', last = ''] = recruiterName
    .trim().split(/\s+/)
    .map(p => p.toLowerCase().replace(/[^a-z]/g, ''));

  return last ? `${first}.${last}@${domain}.com` : `${first}@${domain}.com`;
}

// ── Mock: AI Message Generator ────────────────────────────────────
function mockGenerateMessage(jobTitle = 'the role', company = 'your company', recruiter = '') {
  const firstName = recruiter.trim().split(/\s+/)[0] || 'there';

  const templates = [
    `Hi ${firstName},

I came across the ${jobTitle} role at ${company} and I'm genuinely excited about the opportunity.

With my background in software development and a strong drive to build things that matter, I believe I'd be a great fit for your team. I'd love to learn more about the role and what you're looking for.

Would you be open to a quick 15-minute chat this week?

Best regards,
[Your Name]`,

    `Hello ${firstName},

I noticed ${company} is hiring for a ${jobTitle} — a role that aligns closely with my experience and the kind of work I enjoy most.

I've spent the past few years solving similar challenges and I think there's a strong mutual fit worth exploring. Would you have a few minutes to connect?

Looking forward to hearing from you,
[Your Name]`,

    `Hi ${firstName},

Your ${jobTitle} posting at ${company} immediately caught my attention. The scope of the role and the company's direction are exactly what I've been looking for in my next move.

I'd love a brief conversation to learn more about the team and share a bit about my background.

Thanks for your time,
[Your Name]`,
  ];

  return templates[Math.floor(Math.random() * templates.length)];
}
