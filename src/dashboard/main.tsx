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
        <strong>⌖ &nbsp;FeedbackPin</strong>
        <span>
          <i />
          Stored on this device
        </span>
      </header>
      <div className={styles.workspace}>
        <aside className={styles.sidebar} aria-label="Feedback list">
          <div className={styles.sidebarTitle}>
            <small>WORKSPACE</small>
            <h1>
              Your feedback <b>{reports.length}</b>
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
                {item.label}
                <span>{counts[item.id]}</span>
              </button>
            ))}
          </nav>
          <p className={styles.listTitle}>
            RECENT NOTES <span>{visible.length}</span>
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
                    <span className={styles.pin} aria-hidden="true">
                      ⌖
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
            ◈ &nbsp;Private by default
            <div>
              <small>Nothing leaves this browser.</small>
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
            <article>
              <div className={styles.breadcrumb}>
                FEEDBACK <span>/</span> {selected.status.toUpperCase()}{' '}
                <time>{formatDate(selected.createdAt)}</time>
              </div>
              <div className={styles.detailHeading}>
                <span className={styles.elementTag}>
                  {selected.element.tag}
                </span>
                <div className={styles.title}>
                  <h2>{selected.comment}</h2>
                  <a href={selected.url} target="_blank" rel="noreferrer">
                    {selected.url} ↗
                  </a>
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
                    {selected.status === 'open'
                      ? '✓ Mark as resolved'
                      : '↶ Reopen'}
                  </button>
                  <button
                    aria-label="Delete report"
                    onClick={() => void remove(selected)}
                    disabled={busy}
                  >
                    ⌫
                  </button>
                </div>
              </div>
              <div className={styles.meta}>
                <div>
                  <small>ELEMENT</small>
                  <code>{selected.element.selector}</code>
                </div>
                <div>
                  <small>VIEWPORT</small>
                  <code>
                    {selected.viewport.width} × {selected.viewport.height}
                  </code>
                </div>
              </div>
              <section className={styles.screenshot} aria-label="Screenshot">
                <p>SCREENSHOT {selected.screenshot && <span>WEBP</span>}</p>
                {imageUrl ? (
                  <img
                    src={imageUrl}
                    alt="Saved screenshot of the visible page"
                  />
                ) : (
                  <div>
                    {selected.screenshotError ||
                      'No screenshot was saved with this note.'}
                  </div>
                )}
              </section>
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
