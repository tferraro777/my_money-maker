'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

function VerifyEmailPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = useMemo(() => searchParams.get('token') ?? '', [searchParams]);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('Verifying your email...');
  const [error, setError] = useState('');

  useEffect(() => {
    async function run() {
      if (!token) {
        setLoading(false);
        setError('Missing verification token.');
        return;
      }

      try {
        const res = await fetch('/api/auth/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token })
        });

        const data = (await res.json()) as { ok: boolean; message?: string; error?: string };
        if (!data.ok) {
          setError(data.error ?? 'Verification failed.');
          setLoading(false);
          return;
        }

        setMessage(data.message ?? 'Email verified successfully. Redirecting...');
        setLoading(false);
        setTimeout(() => {
          router.push('/dashboard');
          router.refresh();
        }, 1200);
      } catch {
        setLoading(false);
        setError('Network error. Please try again.');
      }
    }

    run().catch(() => {
      setLoading(false);
      setError('Verification failed.');
    });
  }, [router, token]);

  return (
    <section className="mx-auto max-w-md space-y-4">
      <h1 className="text-2xl font-bold">Email Verification</h1>
      <div className="card space-y-3">
        {loading ? <p className="text-sm text-slate-700">{message}</p> : null}
        {!loading && !error ? <p className="text-sm text-green-700">{message}</p> : null}
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        <Link href="/auth?mode=login" className="text-sm text-brand-700 underline">
          Back to login
        </Link>
      </div>
    </section>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<section className="mx-auto max-w-md" />}>
      <VerifyEmailPageContent />
    </Suspense>
  );
}
