import { escapeHtml } from '@/lib/email-sender';

export function verificationEmailTemplate(verifyUrl: string) {
  const safeUrl = escapeHtml(verifyUrl);
  return {
    subject: 'Verify your email for My Money Maker',
    text: `Verify your email by visiting this link: ${verifyUrl}`,
    html: `
      <h2>Verify your email</h2>
      <p>Thanks for joining My Money Maker. Click below to verify your email:</p>
      <p><a href="${safeUrl}">Verify Email</a></p>
      <p>If the button does not work, copy and paste this URL:</p>
      <p>${safeUrl}</p>
    `
  };
}

export function passwordResetEmailTemplate(resetUrl: string) {
  const safeUrl = escapeHtml(resetUrl);
  return {
    subject: 'Reset your My Money Maker password',
    text: `Reset your password by visiting this link: ${resetUrl}`,
    html: `
      <h2>Password reset</h2>
      <p>Use the link below to set a new password:</p>
      <p><a href="${safeUrl}">Reset Password</a></p>
      <p>If the button does not work, copy and paste this URL:</p>
      <p>${safeUrl}</p>
    `
  };
}
