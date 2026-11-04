import { createReport, type NewReport, type Report } from './report';

const DATABASE = 'feedbackpin';
const STORE = 'reports';
let connection: Promise<IDBDatabase> | undefined;

export async function closeDatabase(): Promise<void> {
  const current = connection;
  connection = undefined;
  const database = await current?.catch(() => undefined);
  database?.close();
}

function openDatabase(): Promise<IDBDatabase> {
  if (!connection) {
    connection = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DATABASE, 1);
      request.onupgradeneeded = () =>
        request.result.createObjectStore(STORE, { keyPath: 'id' });
      request.onsuccess = () => {
        request.result.onversionchange = () => request.result.close();
        resolve(request.result);
      };
      request.onerror = () =>
        reject(
          request.error ?? new Error('Could not open local report storage.'),
        );
      request.onblocked = () =>
        reject(
          new Error('Report storage is busy in another FeedbackPin window.'),
        );
    }).catch((error: unknown) => {
      connection = undefined;
      throw error;
    });
  }
  return connection!;
}

function transact<T>(
  mode: IDBTransactionMode,
  action: (
    store: IDBObjectStore,
    complete: (value: T) => void,
    fail: (error: unknown) => void,
  ) => void,
): Promise<T> {
  return openDatabase().then(
    (database) =>
      new Promise<T>((resolve, reject) => {
        const transaction = database.transaction(STORE, mode);
        let result: T;
        let settled = false;
        const fail = (error: unknown) => {
          if (settled) return;
          settled = true;
          reject(error);
          try {
            transaction.abort();
          } catch {
            /* Transaction may already have completed. */
          }
        };
        transaction.oncomplete = () => {
          if (!settled) resolve(result);
        };
        transaction.onerror = transaction.onabort = () =>
          fail(transaction.error ?? new Error('Local report storage failed.'));
        action(
          transaction.objectStore(STORE),
          (value) => {
            result = value;
          },
          fail,
        );
      }),
  );
}

export function addReport(input: NewReport): Promise<Report> {
  const report = createReport(input);
  return transact('readwrite', (store, complete, fail) => {
    const request = store.add(report);
    request.onsuccess = () => complete(report);
    request.onerror = () =>
      fail(request.error ?? new Error('Could not save report.'));
  });
}

export function getReports(): Promise<Report[]> {
  return transact('readonly', (store, complete, fail) => {
    const request = store.getAll();
    request.onsuccess = () =>
      complete(
        (request.result as Report[]).sort((a, b) => b.createdAt - a.createdAt),
      );
    request.onerror = () =>
      fail(request.error ?? new Error('Could not read reports.'));
  });
}

export function getReport(id: string): Promise<Report | undefined> {
  return transact('readonly', (store, complete, fail) => {
    const request = store.get(id);
    request.onsuccess = () => complete(request.result as Report | undefined);
    request.onerror = () =>
      fail(request.error ?? new Error('Could not read report.'));
  });
}

export function updateReportStatus(
  id: string,
  status: Report['status'],
): Promise<void> {
  return transact('readwrite', (store, complete, fail) => {
    const request = store.get(id);
    request.onsuccess = () => {
      if (!request.result) return fail(new Error('Report no longer exists.'));
      const report = request.result as Report;
      report.status = status;
      const update = store.put(report);
      update.onsuccess = () => complete(undefined);
      update.onerror = () =>
        fail(update.error ?? new Error('Could not update report.'));
    };
    request.onerror = () =>
      fail(request.error ?? new Error('Could not read report.'));
  });
}

export function deleteReport(id: string): Promise<void> {
  return transact('readwrite', (store, complete, fail) => {
    const request = store.delete(id);
    request.onsuccess = () => complete(undefined);
    request.onerror = () =>
      fail(request.error ?? new Error('Could not delete report.'));
  });
}
