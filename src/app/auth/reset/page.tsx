'use client';

import { FormEvent, Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

function ResetPasswordPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get('token') ?? '', [searchParams]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function requestReset(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const res = await fetch('/api/auth/password-reset/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = (await res.json()) as {
        ok: boolean;
        message?: string;
        error?: string;
        devResetUrl?: string;
      };

      if (!data.ok) {
        setError(data.error ?? 'Failed to request password reset.');
        return;
      }

      const devLink = data.devResetUrl ? `\nDev reset link: ${data.devResetUrl}` : '';
      setMessage(`${data.message ?? 'If the account exists, a reset link has been sent.'}${devLink}`);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function confirmReset(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      const res = await fetch('/api/auth/password-reset/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      });
      const data = (await res.json()) as { ok: boolean; message?: string; error?: string };

      if (!data.ok) {
        setError(data.error ?? 'Failed to reset password.');
        return;
      }

      setMessage(data.message ?? 'Password reset complete. Redirecting to login...');
      setTimeout(() => {
        router.push('/auth?mode=login');
        router.refresh();
      }, 1000);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto max-w-md space-y-4">
      <h1 className="text-2xl font-bold">Reset Password</h1>
      <div className="card space-y-3">
        {!token ? (
          <form className="space-y-2" onSubmit={requestReset}>
            <p className="text-sm text-slate-600">
              Enter your email and we&apos;ll send a password reset link.
            </p>
            <input
              className="input"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
            <button className="btn" type="submit" disabled={loading}>
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>
        ) : (
          <form className="space-y-2" onSubmit={confirmReset}>
            <p className="text-sm text-slate-600">Enter your new password.</p>
            <input
              className="input"
              type="password"
              placeholder="New password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
            />
            <button className="btn" type="submit" disabled={loading}>
              {loading ? 'Updating...' : 'Set New Password'}
            </button>
          </form>
        )}

        <Link href="/auth?mode=login" className="text-sm text-brand-700 underline">
          Back to login
        </Link>

        {message ? <p className="whitespace-pre-wrap text-sm text-green-700">{message}</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>
    </section>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<section className="mx-auto max-w-md" />}>
      <ResetPasswordPageContent />
    </Suspense>
  );
}
