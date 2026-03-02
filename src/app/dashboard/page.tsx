import Link from 'next/link';
import { DashboardWidget } from '@/components/dashboard-widget';
import { getOptionalUserId } from '@/lib/auth';
import { ChatQuickForm } from './chat-quick-form';

export default async function DashboardPage() {
  const userId = await getOptionalUserId();
  if (!userId) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <div className="card text-sm">
          <p>You are signed out. Please log in to continue.</p>
          <Link href="/auth?mode=login" className="mt-2 inline-block text-brand-700 underline">
            Go to login
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Dashboard</h1>
      <DashboardWidget userId={userId} />
      <ChatQuickForm />
    </section>
  );
}
