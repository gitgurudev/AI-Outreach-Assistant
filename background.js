// background.js — MV3 Service Worker
// Handles mock API calls: email lookup + AI message generation.
// Replace mock functions with real API calls when ready.

// ── Lifecycle ─────────────────────────────────────────────────────
chrome.runtime.onInstalled.addListener(() => {
  console.log('[AOA] AI Outreach Assistant installed.');
});

// ── Message Router ────────────────────────────────────────────────
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type === 'FIND_EMAIL') {
    sendResponse({ email: mockFindEmail(msg.recruiterName, msg.company) });
    return true;
  }

  if (msg.type === 'GENERATE_MESSAGE') {
    sendResponse({ message: mockGenerateMessage(msg.jobTitle, msg.company, msg.recruiter) });
    return true;
  }

  return true; // keep channel open for async
});

// ── Mock: Email Finder ────────────────────────────────────────────
// Real alternative: Hunter.io API  →  GET https://api.hunter.io/v2/email-finder
//   ?domain=company.com&first_name=John&last_name=Doe&api_key=YOUR_KEY
function mockFindEmail(recruiterName = '', company = '') {
  // Build a plausible domain from the company name
  const domain = company
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .trim()
    .split(/\s+/)
    .filter(w => !['inc', 'llc', 'ltd', 'corp', 'co', 'the', 'and', 'of'].includes(w))
    .join('')
    .slice(0, 20) || 'company';

  const [first = 'hr', last = ''] = recruiterName
    .trim()
    .split(/\s+/)
    .map(p => p.toLowerCase().replace(/[^a-z]/g, ''));

  // Most common corporate email format
  return last
    ? `${first}.${last}@${domain}.com`
    : `${first}@${domain}.com`;
}

// ── Mock: AI Message Generator ────────────────────────────────────
// Real alternative: fetch('https://api.openai.com/v1/chat/completions', { … })
// or:              fetch('https://api.anthropic.com/v1/messages', { … })
function mockGenerateMessage(jobTitle = 'the role', company = 'your company', recruiter = '') {
  const firstName = recruiter.trim().split(/\s+/)[0] || 'there';

  const templates = [
    `Hi ${firstName},

I came across the ${jobTitle} position at ${company} and I'm genuinely excited about the opportunity.

With my background in software development and a strong drive to build things that matter, I believe I'd be a great fit for your team. I'd love to learn more about the role and how I can contribute.

Would you be open to a quick 15-minute chat this week?

Best regards,
[Your Name]`,

    `Hello ${firstName},

I noticed ${company} is hiring for a ${jobTitle} — a role that aligns closely with my experience and the kind of work I'm most passionate about.

I've spent the past few years solving similar challenges and I think there's a strong mutual fit worth exploring. Would you have a few minutes to connect?

Looking forward to hearing from you,
[Your Name]`,

    `Hi ${firstName},

Your ${jobTitle} posting at ${company} immediately caught my attention. The scope of the role and the company's mission are exactly what I've been looking for in my next move.

I'd love to have a brief conversation to share more about my background and learn what success looks like in this role.

Thanks for your time,
[Your Name]`,
  ];

  // Rotate templates on each call so "Regenerate" feels different
  return templates[Math.floor(Math.random() * templates.length)];
}
