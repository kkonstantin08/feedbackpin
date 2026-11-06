import { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  closeDatabase,
  deleteReport,
  getReports,
  updateReportStatus,
} from '../shared/db';
import type { Report } from '../shared/report';
import styles from './dashboard.module.css';

type Filter = 'all' | Report['status'];
const filters: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'resolved', label: 'Resolved' },
];
const formatDate = (time: number) =>
  new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(time);
const formatStorageUsage = (bytes?: number) =>
  typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes < 0
    ? 'Storage estimate unavailable.'
    : bytes >= 1024 * 1024
      ? `${(bytes / (1024 * 1024)).toFixed(1)} MB used locally`
      : `${Math.round(bytes / 1024)} KB used locally`;

export function Dashboard() {
  const [reports, setReports] = useState<Report[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [storageUsage, setStorageUsage] = useState('Reading local storage…');

  useEffect(() => {
    let mounted = true;
    getReports()
      .then((items) => {
        if (!mounted) return;
        setReports(items);
        setSelectedId(items[0]?.id ?? '');
      })
      .catch((cause: unknown) => {
        if (mounted)
          setError(
            cause instanceof Error
              ? cause.message
              : 'Could not load local notes.',
          );
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    if (navigator.storage?.estimate) {
      navigator.storage
        .estimate()
        .then(({ usage }) => {
          if (mounted) setStorageUsage(formatStorageUsage(usage));
        })
        .catch(() => {
          if (mounted) setStorageUsage(formatStorageUsage());
        });
    } else {
      setStorageUsage(formatStorageUsage());
    }
    const close = () => {
      void closeDatabase();
    };
    window.addEventListener('pagehide', close);
    return () => {
      mounted = false;
      window.removeEventListener('pagehide', close);
      void closeDatabase();
    };
  }, []);

  const visible = useMemo(
    () => reports.filter((item) => filter === 'all' || item.status === filter),
    [reports, filter],
  );
  const selected = visible.find((item) => item.id === selectedId) ?? visible[0];
  const imageUrl = useScreenshotUrl(selected?.screenshot);
  const counts = {
    all: reports.length,
    open: reports.filter((item) => item.status === 'open').length,
    resolved: reports.filter((item) => item.status === 'resolved').length,
  };

  async function changeStatus(item: Report) {
    const status = item.status === 'open' ? 'resolved' : 'open';
    setBusy(true);
    setError('');
    try {
      await updateReportStatus(item.id, status);
      setReports((current) =>
        current.map((report) =>
          report.id === item.id ? { ...report, status } : report,
        ),
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not update this note.',
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove(item: Report) {
    setBusy(true);
    setError('');
    try {
      await deleteReport(item.id);
      setReports((current) =>
        current.filter((report) => report.id !== item.id),
      );
      setSelectedId((current) => (current === item.id ? '' : current));
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Could not delete this note.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className={styles.app}>
      <header className={styles.topbar}>
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden="true">
            <svg viewBox="0 0 32 32" fill="none">
              <path d="M16 4.5a8.5 8.5 0 0 0-8.5 8.5c0 6 8.5 14.5 8.5 14.5S24.5 19 24.5 13A8.5 8.5 0 0 0 16 4.5Z" />
              <circle cx="16" cy="13" r="2.6" />
            </svg>
          </span>
          <span className={styles.brandCopy}>
            <strong>FeedbackPin</strong>
            <small>Feedback inbox</small>
          </span>
        </div>
        <span className={styles.privacy}>
          <i />
          Stored on this device
        </span>
      </header>
      <div className={styles.workspace}>
        <aside className={styles.sidebar} aria-label="Feedback navigation">
          <div className={styles.workspacePicker}>
            <span className={styles.workspaceMark} aria-hidden="true">
              F
            </span>
            <span>
              <strong>Personal workspace</strong>
              <small>Private project</small>
            </span>
          </div>
          <div className={styles.sidebarTitle}>
            <small>WORKSPACE</small>
            <h1>
              Inbox <b>{reports.length}</b>
            </h1>
          </div>
          <nav aria-label="Filter reports" className={styles.filters}>
            {filters.map((item) => (
              <button
                key={item.id}
                className={
                  filter === item.id ? styles.filterActive : styles.filter
                }
                aria-pressed={filter === item.id}
                onClick={() => setFilter(item.id)}
              >
                <span
                  className={`${styles.filterMark} ${styles[`filterMark_${item.id}`]}`}
                  aria-hidden="true"
                />
                {item.label}
                <span>{counts[item.id]}</span>
              </button>
            ))}
          </nav>
          <p className={styles.listTitle}>
            Recent feedback <span>{visible.length}</span>
          </p>
          {loading ? (
            <p className={styles.listState}>Loading local notes…</p>
          ) : visible.length ? (
            <ul className={styles.reportList}>
              {visible.map((item) => (
                <li key={item.id}>
                  <button
                    className={
                      selected?.id === item.id
                        ? styles.reportActive
                        : styles.report
                    }
                    aria-pressed={selected?.id === item.id}
                    onClick={() => setSelectedId(item.id)}
                  >
                    <span className={styles.reportMark} aria-hidden="true">
                      <svg viewBox="0 0 20 20" fill="none">
                        <path d="M10 2.5a5.4 5.4 0 0 0-5.4 5.4c0 3.8 5.4 9.2 5.4 9.2s5.4-5.4 5.4-9.2A5.4 5.4 0 0 0 10 2.5Z" />
                        <circle cx="10" cy="7.9" r="1.6" />
                      </svg>
                    </span>
                    <span className={styles.reportCopy}>
                      <strong>{item.comment}</strong>
                      <small>
                        <code>{item.element.tag}</code> ·{' '}
                        {formatDate(item.createdAt)}
                      </small>
                    </span>
                    <i
                      className={
                        item.status === 'resolved'
                          ? styles.resolvedDot
                          : styles.openDot
                      }
                      aria-label={item.status}
                    />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.listState}>
              {reports.length
                ? `No ${filter} notes yet.`
                : 'Your notes will appear here.'}
            </p>
          )}
          <footer className={styles.sidebarFoot}>
            <span className={styles.privacyMark} aria-hidden="true">
              <svg viewBox="0 0 20 20" fill="none">
                <path d="M5.5 8.3V6.5a4.5 4.5 0 0 1 9 0v1.8" />
                <rect x="4" y="8.3" width="12" height="9" rx="2" />
                <circle cx="10" cy="12.6" r="1" />
              </svg>
            </span>
            <div className={styles.privacyCopy}>
              <strong>Private by default</strong>
              <small aria-live="polite">{storageUsage}</small>
            </div>
          </footer>
        </aside>
        <section className={styles.detail} aria-label="Report details">
          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}
          {loading ? (
            <p className={styles.empty}>Opening your notes…</p>
          ) : !selected ? (
            <div className={styles.empty}>
              <span className={styles.emptyPin} aria-hidden="true">
                ⌖
              </span>
              <h2>No notes yet</h2>
              <p>
                Open a website, then choose FeedbackPin from the toolbar to
                leave your first note.
              </p>
            </div>
          ) : (
            <article className={styles.detailPanel}>
              <div className={styles.recordHeader}>
                <div className={styles.breadcrumb}>
                  <span>Feedback</span>
                  <span aria-hidden="true">/</span>
                  Inbox
                  <time>{formatDate(selected.createdAt)}</time>
                </div>
                <div className={styles.detailHeading}>
                  <div className={styles.title}>
                    <div className={styles.issueMeta}>
                      <span
                        className={
                          selected.status === 'resolved'
                            ? styles.statusResolved
                            : styles.statusOpen
                        }
                      >
                        <i />
                        {selected.status === 'resolved' ? 'Resolved' : 'Open'}
                      </span>
                      <span className={styles.elementTag}>
                        {selected.element.tag}
                      </span>
                    </div>
                    <h2>{selected.comment}</h2>
                  </div>
                  <div className={styles.actions}>
                    <button
                      aria-label={
                        selected.status === 'open'
                          ? 'Mark as resolved'
                          : 'Reopen report'
                      }
                      onClick={() => void changeStatus(selected)}
                      disabled={busy}
                    >
                      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                        {selected.status === 'open' ? (
                          <path d="m4.5 10 3.5 3.5 7.5-7.5" />
                        ) : (
                          <path d="M5 8a5.5 5.5 0 1 1 .2 4.3M5 4.5V8h3.5" />
                        )}
                      </svg>
                      {selected.status === 'open'
                        ? 'Mark as resolved'
                        : 'Reopen'}
                    </button>
                    <button
                      aria-label="Delete report"
                      onClick={() => void remove(selected)}
                      disabled={busy}
                    >
                      <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">
                        <path d="M4 5.5h12M8 5.5V4h4v1.5m-6.5 0 .7 10h7.6l.7-10M8.5 8.5v4m3-4v4" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
              <section
                className={styles.pageContext}
                aria-labelledby="page-context-title"
              >
                <div className={styles.contextHeader}>
                  <div>
                    <small>PAGE CONTEXT</small>
                    <h3 id="page-context-title">Reported on this page</h3>
                  </div>
                  <span className={styles.viewport}>
                    <span aria-hidden="true">↔</span>
                    {selected.viewport.width} × {selected.viewport.height}
                  </span>
                </div>
                <div className={styles.contextRows}>
                  <div className={styles.contextRow}>
                    <span className={styles.contextIcon} aria-hidden="true">
                      <svg viewBox="0 0 20 20" fill="none">
                        <circle cx="10" cy="10" r="7" />
                        <path d="M3.5 10h13M10 3a11 11 0 0 1 0 14M10 3a11 11 0 0 0 0 14" />
                      </svg>
                    </span>
                    <div>
                      <small>PAGE URL</small>
                      <a href={selected.url} target="_blank" rel="noreferrer">
                        {selected.url}
                      </a>
                    </div>
                    <a
                      className={styles.openPage}
                      href={selected.url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="Open reported page in a new tab"
                    >
                      ↗
                    </a>
                  </div>
                  <div className={styles.contextRow}>
                    <span className={styles.contextIcon} aria-hidden="true">
                      <svg viewBox="0 0 20 20" fill="none">
                        <rect x="3" y="3" width="5" height="5" rx="1" />
                        <rect x="12" y="12" width="5" height="5" rx="1" />
                        <path d="M8 5.5h3a1 1 0 0 1 1 1v5.5" />
                      </svg>
                    </span>
                    <div>
                      <small>SELECTED ELEMENT</small>
                      <code>{selected.element.selector}</code>
                    </div>
                    <span className={styles.elementTag}>
                      {selected.element.tag}
                    </span>
                  </div>
                </div>
              </section>
              {imageUrl && (
                <section
                  className={styles.screenshot}
                  aria-label="Saved screenshot"
                >
                  <p>Saved screenshot</p>
                  <img
                    src={imageUrl}
                    alt="Saved screenshot of the visible page"
                  />
                </section>
              )}
              {!imageUrl && selected.screenshotError && (
                <p className={styles.attachmentNotice} role="note">
                  {selected.screenshotError}
                </p>
              )}
            </article>
          )}
        </section>
      </div>
    </main>
  );
}

function useScreenshotUrl(screenshot?: Blob): string {
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!screenshot) {
      setUrl('');
      return;
    }
    const objectUrl = URL.createObjectURL(screenshot);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [screenshot]);
  return url;
}

const root = document.getElementById('root');
if (root) createRoot(root).render(<Dashboard />);
