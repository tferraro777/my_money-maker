import { redirect } from 'next/navigation';
import { getOptionalUserId } from '@/lib/auth';
import { getTrackerSnapshot } from '@/lib/tracker';

export default async function TrackerPage() {
  const userId = await getOptionalUserId();
  if (!userId) {
    redirect('/auth');
  }

  const snapshot = await getTrackerSnapshot(userId);

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">Tracker</h1>

      <div className="card">
        <h2 className="text-lg font-semibold">Income Totals</h2>
        <div className="mt-3 space-y-2 text-sm">
          {snapshot.incomeTotals.length === 0 && <p>No income entries yet.</p>}
          {snapshot.incomeTotals.map((item) => (
            <div key={item.currency} className="rounded-xl border border-slate-200 p-2">
              <p className="font-semibold">{item.currency}</p>
              <p>Today: {item.today}</p>
              <p>Week: {item.week}</p>
              <p>Month: {item.month}</p>
              <p>Rolling 30d: {item.rolling30d}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <form action="/api/tracker/income" method="post" className="card space-y-2">
          <h2 className="text-lg font-semibold">Quick Add Income</h2>
          <input className="input" type="datetime-local" name="occurredAtLocal" required />
          <input className="input" type="text" name="userTimezone" placeholder="America/New_York" required />
          <input className="input" type="number" step="0.01" min="0" name="amount" placeholder="Amount" required />
          <input className="input" type="text" name="currency" defaultValue="USD" required />
          <select className="input" name="type" defaultValue="sale">
            <option value="sale">Sale</option>
            <option value="commission">Commission</option>
            <option value="bonus">Bonus</option>
            <option value="other">Other</option>
          </select>
          <button className="btn" type="submit">
            Save Income
          </button>
        </form>

        <form action="/api/tracker/activity" method="post" className="card space-y-2">
          <h2 className="text-lg font-semibold">Quick Add Activity</h2>
          <input className="input" type="datetime-local" name="occurredAtLocal" required />
          <input className="input" type="text" name="userTimezone" placeholder="America/New_York" required />
          <select className="input" name="activityType" defaultValue="outreach_messages">
            <option value="outreach_messages">Outreach Messages</option>
            <option value="follow_up_messages">Follow-up Messages</option>
            <option value="content_posts">Content Posts</option>
            <option value="live_videos">Live Videos</option>
            <option value="calls_booked">Calls Booked</option>
            <option value="presentations_given">Presentations Given</option>
            <option value="samples_sent">Samples Sent</option>
            <option value="team_trainings">Team Trainings</option>
            <option value="custom">Custom</option>
          </select>
          <input className="input" type="number" min="1" step="1" name="quantity" defaultValue="1" required />
          <button className="btn" type="submit">
            Save Activity
          </button>
        </form>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold">Last 30 Days Activity</h2>
        <p className="mb-2 text-sm text-slate-600">Streak: {snapshot.streakDays} days</p>
        <ul className="space-y-1 text-sm">
          {snapshot.activityTotals.length === 0 && <li>No activity entries yet.</li>}
          {snapshot.activityTotals.map((item) => (
            <li key={item.activity_type}>
              {item.activity_type}: {item.total}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
