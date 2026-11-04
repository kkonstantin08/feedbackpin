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
import { afterEach, describe, expect, it } from 'vitest';
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

afterEach(async () => {
  cleanup();
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
  it('shows a useful empty state when no reports exist', async () => {
    render(<Dashboard />);

    expect(await screen.findByText(/no notes yet/i)).toBeInTheDocument();
    expect(
      screen.getByText(
        /open a website, then choose feedbackpin from the toolbar/i,
      ),
    ).toBeInTheDocument();
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

    expect(
      await screen.findByRole('button', {
        name: /button needs a clearer label/i,
      }),
    ).toBeInTheDocument();
    await user.click(filterNav.getByRole('button', { name: /^Resolved/ }));
    expect(
      await screen.findByRole('button', { name: /resolved layout issue/i }),
    ).toBeInTheDocument();
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
