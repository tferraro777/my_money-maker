import Link from 'next/link';

export default function HomePage() {
  return (
    <section className="space-y-4">
      <h1 className="text-3xl font-bold">Build your business daily with AI coaching.</h1>
      <p className="max-w-2xl text-slate-600">
        My Money Maker gives solopreneurs daily action plans, recruiting help, content strategy, objection handling,
        product-positioning guidance, and a built-in income + activity tracker.
      </p>
      <div className="flex gap-3">
        <Link href="/dashboard" className="btn">
          Open Dashboard
        </Link>
        <Link href="/tracker" className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold">
          Open Tracker
        </Link>
      </div>
    </section>
  );
}
