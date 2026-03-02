'use client';

import { FormEvent, Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

type Mode = 'login' | 'register';

function AuthPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode: Mode = searchParams.get('mode') === 'register' ? 'register' : 'login';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setInfo('');

    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
      const payload = mode === 'login' ? { email, password } : { email, password, fullName };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = (await res.json()) as { ok: boolean; error?: string; devVerifyUrl?: string; verifyExpiresInHours?: number };

      if (!data.ok) {
        setError(data.error ?? 'Authentication failed.');
        return;
      }

      if (mode === 'register' && data.devVerifyUrl) {
        setInfo(`Account created. Verify email: ${data.devVerifyUrl}`);
      }
      router.push('/dashboard');
      router.refresh();
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto max-w-md space-y-4">
      <h1 className="text-2xl font-bold">Account Access</h1>
      <div className="card">
        <div className="mb-3 flex gap-2 text-sm">
          <Link
            href="/auth?mode=login"
            className={`rounded-lg border px-3 py-1 ${
              mode === 'login'
                ? 'border-clemson-purple bg-clemson-purple text-white'
                : 'border-clemson-stadium bg-white text-clemson-avenue'
            }`}
          >
            Login
          </Link>
          <Link
            href="/auth?mode=register"
            className={`rounded-lg border px-3 py-1 ${
              mode === 'register'
                ? 'border-clemson-purple bg-clemson-purple text-white'
                : 'border-clemson-stadium bg-white text-clemson-avenue'
            }`}
          >
            Register
          </Link>
        </div>

        <p className="mb-3 text-sm text-slate-600">
          {mode === 'login'
            ? 'Please enter credentials to Login.'
            : 'Please register your new account.'}
        </p>

        <form className="space-y-2" onSubmit={onSubmit}>
          {mode === 'register' ? (
            <input
              className="input"
              placeholder="Full name"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              required
            />
          ) : null}
          <input
            className="input"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <input
            className="input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            minLength={8}
          />
          <button className="btn" type="submit" disabled={loading}>
            {loading ? 'Please wait...' : mode === 'login' ? 'Login' : 'Create Account'}
          </button>
        </form>

        <div className="mt-3 text-sm">
          <Link href="/auth/reset" className="text-clemson-purple underline">
            Forgot password?
          </Link>
        </div>
        {info ? <p className="mt-2 break-all text-sm text-green-700">{info}</p> : null}
        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
      </div>
    </section>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<section className="mx-auto max-w-md" />}>
      <AuthPageContent />
    </Suspense>
  );
}
