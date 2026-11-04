import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import styles from './popup.module.css';

export function Popup() {
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const dashboard = chrome.runtime.getURL('src/dashboard/index.html');

  async function startSelection() {
    setError('');
    setStarting(true);
    try {
      const response = await chrome.runtime.sendMessage({
        type: 'START_SELECTION',
      });
      if (!response?.ok)
        setError(
          response?.error ?? 'FeedbackPin could not start on this page.',
        );
    } catch {
      setError(
        'FeedbackPin could not reach this page. Try reopening the extension.',
      );
    } finally {
      setStarting(false);
    }
  }

  return (
    <main className={styles.popup}>
      <header className={styles.header}>
        <div className={styles.brandMark} aria-hidden="true">
          <svg viewBox="0 0 32 32" fill="none">
            <path d="M16 4.5a8.5 8.5 0 0 0-8.5 8.5c0 6 8.5 14.5 8.5 14.5S24.5 19 24.5 13A8.5 8.5 0 0 0 16 4.5Z" />
            <circle cx="16" cy="13" r="2.6" />
          </svg>
        </div>
        <div>
          <h1>FeedbackPin</h1>
          <p>Visual feedback, kept local</p>
        </div>
        <span className={styles.localTag}>
          <span />
          Local
        </span>
      </header>

      <section className={styles.intro} aria-labelledby="intro-title">
        <span className={styles.eyebrow}>ON THIS PAGE</span>
        <h2 id="intro-title">Pin feedback to an element.</h2>
        <p>
          Choose the part that needs attention and leave a clear note for your
          next fix.
        </p>
      </section>

      <button
        className={styles.primary}
        onClick={startSelection}
        disabled={starting}
      >
        <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
          <path d="M4 3.5 15.6 10l-5 1.1L8.4 16 4 3.5Z" />
        </svg>
        {starting ? 'Starting…' : 'Select an element'}
        <span className={styles.shortcut}>ESC to cancel</span>
      </button>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <footer className={styles.footer}>
        <span>Your notes stay on this device.</span>
        <a href={dashboard} target="_blank">
          Open reports <span aria-hidden="true">↗</span>
        </a>
      </footer>
    </main>
  );
}

const root = document.getElementById('root');
if (root) createRoot(root).render(<Popup />);
