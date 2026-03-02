'use client';

export default function GlobalError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <html>
      <body>
        <main style={{ maxWidth: 720, margin: '40px auto', padding: 16, fontFamily: 'sans-serif' }}>
          <h1>Application error</h1>
          <p>{error.message || 'Unexpected error.'}</p>
          <button onClick={() => reset()} type="button">
            Retry
          </button>
        </main>
      </body>
    </html>
  );
}
