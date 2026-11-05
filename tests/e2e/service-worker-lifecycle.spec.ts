import { spawn, type ChildProcess } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { chromium, expect, test } from '@playwright/test';

const extensionPath = path.resolve(
  process.env.FEEDBACKPIN_EXTENSION_PATH ?? 'dist',
);

type Target = { targetId: string; type: string; url: string };
type Message = {
  id?: number;
  result?: unknown;
  error?: { message: string };
  method?: string;
  params?: { targetInfo?: Target; targetId?: string };
};

function withTimeout<T>(
  promise: Promise<T>,
  milliseconds: number,
  message: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), milliseconds);
    }),
  ]).finally(() => clearTimeout(timer));
}

async function stopChrome(chrome: ChildProcess): Promise<void> {
  if (!chrome.pid || chrome.exitCode !== null || chrome.signalCode !== null)
    return;
  const exited = once(chrome, 'exit');
  chrome.kill('SIGTERM');
  try {
    await withTimeout(exited, 5_000, 'Chrome did not stop after SIGTERM.');
  } catch {
    if (chrome.exitCode === null && chrome.signalCode === null) {
      const killed = once(chrome, 'exit');
      chrome.kill('SIGKILL');
      await killed;
    }
  }
}

test('MV3 service worker stops after its idle timeout without debugger attachment', async () => {
  test.setTimeout(110_000);
  const profilePath = await mkdtemp(
    path.join(tmpdir(), 'feedbackpin-worker-lifecycle-'),
  );
  const chrome = spawn(
    chromium.executablePath(),
    [
      `--user-data-dir=${profilePath}`,
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      '--remote-debugging-address=127.0.0.1',
      '--remote-debugging-port=0',
      '--no-first-run',
      '--no-default-browser-check',
      '--no-sandbox',
      '--disable-background-networking',
      '--disable-component-update',
      '--disable-gpu',
    ],
    { stdio: ['ignore', 'ignore', 'pipe'] },
  );
  let spawnError = '';
  const stderr: string[] = [];
  chrome.on('error', (error) => {
    spawnError = error.message;
  });
  chrome.stderr?.on('data', (chunk: Buffer) => stderr.push(chunk.toString()));
  let socket: WebSocket | undefined;

  try {
    let port = 0;
    const deadline = Date.now() + 15_000;
    while (!port && Date.now() < deadline) {
      try {
        port = Number(
          (
            await readFile(path.join(profilePath, 'DevToolsActivePort'), 'utf8')
          ).split('\n')[0],
        );
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }
    expect(
      port,
      `Chrome DevTools port was not created. exit=${chrome.exitCode} error=${spawnError} stderr=${stderr.join('').trim()}`,
    ).toBeGreaterThan(0);

    const response = await fetch(`http://127.0.0.1:${port}/json/version`, {
      signal: AbortSignal.timeout(5_000),
    });
    const { webSocketDebuggerUrl } = (await response.json()) as {
      webSocketDebuggerUrl: string;
    };
    socket = new WebSocket(webSocketDebuggerUrl);
    await new Promise<void>((resolve, reject) => {
      socket!.addEventListener('open', () => resolve(), { once: true });
      socket!.addEventListener(
        'error',
        () => reject(new Error('Could not connect to Chrome DevTools.')),
        { once: true },
      );
    });

    let nextId = 0;
    const pending = new Map<
      number,
      { resolve: (result: unknown) => void; reject: (error: Error) => void }
    >();
    const targets = new Map<string, Target>();
    const destroyed = new Set<string>();
    const destroyedWaiters = new Map<string, () => void>();
    let targetAvailable: (() => void) | undefined;
    socket.addEventListener('message', (event) => {
      const message = JSON.parse(String(event.data)) as Message;
      if (message.id !== undefined) {
        const operation = pending.get(message.id);
        if (!operation) return;
        pending.delete(message.id);
        if (message.error) operation.reject(new Error(message.error.message));
        else operation.resolve(message.result);
      } else if (
        message.method === 'Target.targetCreated' &&
        message.params?.targetInfo?.type === 'service_worker' &&
        message.params.targetInfo.url.startsWith('chrome-extension://')
      ) {
        targets.set(
          message.params.targetInfo.targetId,
          message.params.targetInfo,
        );
        targetAvailable?.();
      } else if (
        message.method === 'Target.targetDestroyed' &&
        message.params?.targetId
      ) {
        destroyed.add(message.params.targetId);
        destroyedWaiters.get(message.params.targetId)?.();
      }
    });

    const send = <T>(method: string, params: object = {}) =>
      new Promise<T>((resolve, reject) => {
        const id = ++nextId;
        pending.set(id, {
          resolve: (result) => resolve(result as T),
          reject,
        });
        socket!.send(JSON.stringify({ id, method, params }));
      });

    await send('Target.setDiscoverTargets', { discover: true });
    const { targetInfos } = await send<{ targetInfos: Target[] }>(
      'Target.getTargets',
    );
    for (const target of targetInfos) {
      if (
        target.type === 'service_worker' &&
        target.url.startsWith('chrome-extension://')
      ) {
        targets.set(target.targetId, target);
      }
    }
    if (!targets.size) {
      const available = new Promise<void>((resolve) => {
        targetAvailable = resolve;
      });
      await withTimeout(available, 20_000, 'Extension worker did not start.');
    }

    const worker = targets.values().next().value as Target | undefined;
    expect(worker?.url).toMatch(/^chrome-extension:\/\//);
    const termination = worker
      ? new Promise<void>((resolve) => {
          if (destroyed.has(worker.targetId)) resolve();
          else destroyedWaiters.set(worker.targetId, resolve);
        })
      : Promise.reject(new Error('Extension worker target was not observed.'));
    await expect(
      withTimeout(termination, 60_000, 'MV3 service worker stayed active.'),
    ).resolves.toBeUndefined();
  } finally {
    socket?.close();
    await stopChrome(chrome);
    await rm(profilePath, { recursive: true, force: true });
  }
});
