'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';

export default function ResendVerificationPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      const res = await fetch('/api/auth/verify/resend', { method: 'POST' });
      const data = (await res.json()) as {
        ok: boolean;
        error?: string;
        message?: string;
        devVerifyUrl?: string;
      };

      if (!data.ok) {
        setError(data.error ?? 'Unable to resend verification.');
        return;
      }

      setMessage(`${data.message ?? 'Verification link sent.'}${data.devVerifyUrl ? `\n${data.devVerifyUrl}` : ''}`);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto max-w-md space-y-4">
      <h1 className="text-2xl font-bold">Resend Verification</h1>
      <div className="card space-y-3">
        <p className="text-sm text-slate-600">Request a new email verification link for your current account.</p>
        <form onSubmit={onSubmit}>
          <button className="btn" type="submit" disabled={loading}>
            {loading ? 'Sending...' : 'Resend Verification Email'}
          </button>
        </form>
        <Link href="/dashboard" className="text-sm text-brand-700 underline">
          Back to dashboard
        </Link>
        {message ? <p className="whitespace-pre-wrap break-all text-sm text-green-700">{message}</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>
    </section>
  );
}
