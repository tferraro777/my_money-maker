'use client';

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="card space-y-3">
      <h2 className="text-xl font-semibold">Something went wrong</h2>
      <p className="text-sm text-slate-600">{error.message || 'Unexpected error.'}</p>
      <button className="btn" onClick={() => reset()} type="button">
        Try again
      </button>
    </div>
  );
}
