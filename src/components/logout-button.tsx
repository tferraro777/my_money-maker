'use client';

import { useRouter } from 'next/navigation';

export function LogoutButton() {
  const router = useRouter();

  async function onLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/auth');
    router.refresh();
  }

  return (
    <button className="rounded-lg border border-slate-300 px-3 py-1 text-sm" onClick={onLogout} type="button">
      Logout
    </button>
  );
}
