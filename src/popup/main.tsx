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
          <p>Element feedback, kept local</p>
        </div>
        <span className={styles.localTag}>
          <span />
          Local only
        </span>
      </header>

      <section className={styles.intro} aria-labelledby="intro-title">
        <span className={styles.eyebrow}>THIS PAGE</span>
        <h2 id="intro-title">Point to what needs attention.</h2>
        <p>Select an element, then leave a clear note for the next fix.</p>
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
        <kbd className={styles.shortcut}>Esc to cancel</kbd>
      </button>

      <p className={styles.hint}>
        Click any element on the page to place a note.
      </p>

      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <footer className={styles.footer}>
        <div className={styles.privacyNote}>
          <span className={styles.lockMark} aria-hidden="true">
            <svg viewBox="0 0 20 20" fill="none">
              <path d="M5.5 8.3V6.5a4.5 4.5 0 0 1 9 0v1.8" />
              <rect x="4" y="8.3" width="12" height="9" rx="2" />
              <circle cx="10" cy="12.6" r="1" />
            </svg>
          </span>
          <span>
            <strong>Private by default</strong>
            <small>Your notes stay in this browser.</small>
          </span>
        </div>
        <a href={dashboard} target="_blank">
          Open inbox <span aria-hidden="true">↗</span>
        </a>
      </footer>
    </main>
  );
}

const root = document.getElementById('root');
if (root) createRoot(root).render(<Popup />);
