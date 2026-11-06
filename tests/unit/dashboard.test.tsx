import 'fake-indexeddb/auto';
import '@testing-library/jest-dom/vitest';
import {
  cleanup,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  closeDatabase,
  addReport,
  getReports,
  updateReportStatus,
} from '../../src/shared/db';
import { Dashboard } from '../../src/dashboard/main';

const report = (comment: string) => ({
  comment,
  url: 'https://example.test/page?token=private#section',
  viewport: { width: 1280, height: 720 },
  element: { tag: 'button', selector: 'html > body > button:nth-of-type(1)' },
});
const originalStorage = Object.getOwnPropertyDescriptor(navigator, 'storage');

afterEach(async () => {
  cleanup();
  if (originalStorage)
    Object.defineProperty(navigator, 'storage', originalStorage);
  else Reflect.deleteProperty(navigator, 'storage');
  await closeDatabase();
  for (const database of await indexedDB.databases()) {
    if (database.name) {
      await new Promise<void>((resolve, reject) => {
        const request = indexedDB.deleteDatabase(database.name!);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    }
  }
});

describe('local feedback dashboard', () => {
  it('shows local storage use when the browser provides an estimate', async () => {
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: { estimate: async () => ({ usage: 1_500_000, quota: 5_000_000 }) },
    });
    render(<Dashboard />);

    expect(
      await screen.findByText(/1\.4 MB used locally/i),
    ).toBeInTheDocument();
  });

  it('keeps report controls available if storage estimation fails', async () => {
    await addReport(report('Still available after estimate failure'));
    Object.defineProperty(navigator, 'storage', {
      configurable: true,
      value: { estimate: async () => Promise.reject(new Error('unavailable')) },
    });
    render(<Dashboard />);

    expect(
      await screen.findByText(/storage estimate unavailable/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: 'Still available after estimate failure',
      }),
    ).toBeInTheDocument();
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Delete report' }));
    expect(
      await screen.findByText(/your notes will appear here/i),
    ).toBeInTheDocument();
  });

  it('shows a useful empty state when no reports exist', async () => {
    render(<Dashboard />);

    expect(await screen.findByText(/no notes yet/i)).toBeInTheDocument();
    expect(
      screen.getByText(
        /open a website, then choose feedbackpin from the toolbar/i,
      ),
    ).toBeInTheDocument();
  });

  it('does not reserve a screenshot panel for text-only reports', async () => {
    await addReport(report('Text-only issue'));
    render(<Dashboard />);

    expect(
      await screen.findByRole('heading', { name: 'Text-only issue' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Page URL' })).toHaveTextContent(
      'https://example.test/page',
    );
    expect(
      screen.getByRole('group', { name: 'Selected element' }),
    ).toHaveTextContent('html > body > button:nth-of-type(1)');
    expect(screen.queryByRole('region', { name: /screenshot/i })).toBeNull();
    expect(screen.queryByText(/no screenshot was saved/i)).toBeNull();
  });

  it('continues displaying images already saved by older builds', async () => {
    const saved = await addReport(report('Older note with an image'));
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open('feedbackpin', 1);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction('reports', 'readwrite');
      transaction.objectStore('reports').put({
        ...saved,
        screenshot: new Blob(['legacy image'], { type: 'image/webp' }),
      });
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:legacy-image');
    render(<Dashboard />);

    expect(
      await screen.findByRole('img', { name: /saved screenshot/i }),
    ).toHaveAttribute('src', 'blob:legacy-image');
  });

  it('filters reports by status and updates the selected report status', async () => {
    const completed = await addReport(report('Resolved layout issue'));
    await updateReportStatus(completed.id, 'resolved');
    await addReport(report('Button needs a clearer label'));
    const records = await getReports();
    const resolved = records.find(
      (item) => item.comment === 'Resolved layout issue',
    )!;
    const open = records.find(
      (item) => item.comment === 'Button needs a clearer label',
    )!;
    const { getByRole, queryByRole } = render(<Dashboard />);
    const user = userEvent.setup();
    const filterNav = within(
      getByRole('navigation', { name: 'Filter reports' }),
    );

    const openRow = await screen.findByRole('button', {
      name: /button needs a clearer label/i,
    });
    expect(openRow).toBeInTheDocument();
    expect(within(openRow).getByText('Open')).toBeInTheDocument();
    await user.click(filterNav.getByRole('button', { name: /^Resolved/ }));
    const resolvedRow = await screen.findByRole('button', {
      name: /resolved layout issue/i,
    });
    expect(resolvedRow).toBeInTheDocument();
    expect(within(resolvedRow).getByText('Resolved')).toBeInTheDocument();
    expect(
      queryByRole('button', { name: /button needs a clearer label/i }),
    ).not.toBeInTheDocument();
    await user.click(filterNav.getByRole('button', { name: /^Open/ }));
    expect(
      await screen.findByRole('button', {
        name: /button needs a clearer label/i,
      }),
    ).toBeInTheDocument();
    expect(
      queryByRole('button', { name: /resolved layout issue/i }),
    ).not.toBeInTheDocument();

    await user.click(filterNav.getByRole('button', { name: /^All/ }));
    await user.click(
      getByRole('button', { name: /button needs a clearer label/i }),
    );
    await user.click(getByRole('button', { name: 'Mark as resolved' }));
    await waitFor(async () =>
      expect(
        (await getReports()).find((item) => item.id === open.id)?.status,
      ).toBe('resolved'),
    );
    expect(
      (await getReports()).find((item) => item.id === resolved.id)?.status,
    ).toBe('resolved');
  });

  it('deletes the selected report from local storage', async () => {
    await addReport(report('Remove this note'));
    render(<Dashboard />);
    const user = userEvent.setup();

    await screen.findByRole('heading', { name: 'Remove this note' });
    await user.click(screen.getByRole('button', { name: /delete report/i }));

    await waitFor(async () => expect(await getReports()).toEqual([]));
  });
});
