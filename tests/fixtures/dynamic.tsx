import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';

function DynamicPage() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), 250);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <main>
      <h1>Dynamic application</h1>
      {ready ? (
        <button id="react-target">Loaded after render</button>
      ) : (
        <p>Loading…</p>
      )}
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<DynamicPage />);
