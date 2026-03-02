export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

function requireConfig() {
  const from = process.env.EMAIL_FROM;
  const apiKey = process.env.EMAIL_PROVIDER_API_KEY;

  if (!from || !apiKey) {
    return null;
  }

  return { from, apiKey };
}

export async function sendEmail(input: SendEmailInput): Promise<{ sent: boolean; provider: string }> {
  const config = requireConfig();
  if (!config) {
    console.warn('[email] Missing EMAIL_FROM or EMAIL_PROVIDER_API_KEY; email not sent.');
    return { sent: false, provider: 'none' };
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: config.from,
      to: [input.to],
      subject: input.subject,
      html: input.html,
      text: input.text
    })
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Email send failed: ${res.status} ${body}`);
  }

  return { sent: true, provider: 'resend' };
}

export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
