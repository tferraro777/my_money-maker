import { redirect } from 'next/navigation';
import { getOptionalUserId } from '@/lib/auth';
import { db } from '@/lib/db';

export default async function AdminPage() {
  const userId = await getOptionalUserId();
  if (!userId) {
    redirect('/auth');
  }

  const roleRes = await db.query('SELECT role FROM users WHERE id = $1', [userId]);
  const role = roleRes.rows[0]?.role;
  if (!['admin', 'support', 'analyst'].includes(role)) {
    return (
      <section className="space-y-4">
        <h1 className="text-2xl font-bold">Admin</h1>
        <div className="card text-sm">You do not have admin access.</div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Admin</h1>
      <div className="card space-y-2 text-sm">
        <p>Role-based admin console scaffold is active.</p>
        <p>Implemented starter endpoints include:</p>
        <ul className="list-disc pl-5">
          <li>Log search API: /api/admin/logs/search</li>
          <li>Referral claim processing: /api/referrals/claim</li>
          <li>Manual actions should append to admin_audit_log before release.</li>
        </ul>
      </div>
    </section>
  );
}
