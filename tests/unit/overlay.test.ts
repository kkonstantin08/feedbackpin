import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  collectRedactionRects,
  showReportForm,
} from '../../src/content/overlay';

afterEach(() => {
  document
    .querySelectorAll('[data-feedbackpin-host]')
    .forEach((host) => host.remove());
});

function openForm() {
  document.body.innerHTML =
    '<button data-private="token">Private page text</button>';
  const target = document.querySelector('button')!;
  const onSave = vi.fn().mockResolvedValue(undefined);
  showReportForm(target, { onSave, onCapture: vi.fn() });
  const host = document.querySelector('[data-feedbackpin-host]')!;
  return { onSave, host, root: host.shadowRoot! };
}

describe('on-page report form', () => {
  it('captures a screenshot only on explicit request, then previews it before saving', async () => {
    const target = document.createElement('button');
    const onCapture = vi
      .fn()
      .mockResolvedValue(new Blob(['webp'], { type: 'image/webp' }));
    const onSave = vi.fn().mockResolvedValue(undefined);
    showReportForm(target, { onCapture, onSave });
    const root = document.querySelector('[data-feedbackpin-host]')!.shadowRoot!;
    expect(onCapture).not.toHaveBeenCalled();

    root.querySelector<HTMLButtonElement>('[data-capture]')!.click();
    await vi.waitFor(() => expect(onCapture).toHaveBeenCalledOnce());
    expect(root.querySelector('img[alt="Screenshot preview"]')).not.toBeNull();
    root.querySelector('textarea')!.value = 'Screenshot reviewed';
    root
      .querySelector<HTMLFormElement>('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await vi.waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave.mock.calls[0]?.[1]).toMatch(/^data:image\/webp;base64,/);
  });

  it('saves the note without an image and preserves the screenshot failure reason', async () => {
    const target = document.createElement('button');
    const onCapture = vi
      .fn()
      .mockRejectedValue(new Error('Screenshot exceeds the 2 MiB limit.'));
    const onSave = vi.fn().mockResolvedValue(undefined);
    showReportForm(target, { onCapture, onSave });
    const root = document.querySelector('[data-feedbackpin-host]')!.shadowRoot!;

    root.querySelector<HTMLButtonElement>('[data-capture]')!.click();
    await vi.waitFor(() =>
      expect(root.querySelector('.capture-error')?.textContent).toContain(
        '2 MiB',
      ),
    );
    root.querySelector('textarea')!.value = 'Keep the note';
    root
      .querySelector<HTMLFormElement>('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await vi.waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    expect(onSave.mock.calls[0]?.[1]).toBeUndefined();
    expect(onSave.mock.calls[0]?.[2]).toContain('2 MiB');
  });

  it('prevents a save from racing an in-progress screenshot capture', async () => {
    const target = document.createElement('button');
    let finishCapture!: (blob: Blob) => void;
    const capture = new Promise<Blob>((resolve) => {
      finishCapture = resolve;
    });
    const onCapture = vi.fn(() => capture);
    showReportForm(target, {
      onCapture,
      onSave: vi.fn().mockResolvedValue(undefined),
    });
    const root = document.querySelector('[data-feedbackpin-host]')!.shadowRoot!;

    root.querySelector<HTMLButtonElement>('[data-capture]')!.click();
    await vi.waitFor(() => expect(onCapture).toHaveBeenCalledOnce());
    expect(
      root.querySelector<HTMLButtonElement>('[type="submit"]')!.disabled,
    ).toBe(true);
    finishCapture(new Blob(['webp'], { type: 'image/webp' }));
    await vi.waitFor(() =>
      expect(
        root.querySelector<HTMLButtonElement>('[type="submit"]')!.disabled,
      ).toBe(false),
    );
  });

  it('masks the full visible row of each input, editable and iframe region', () => {
    document.body.innerHTML =
      '<input><textarea></textarea><select></select><div contenteditable="true"></div><iframe></iframe><input style="display:none">';
    const elements = [
      ...document.querySelectorAll(
        'input,textarea,select,[contenteditable],iframe',
      ),
    ];
    elements.forEach((element, index) => {
      vi.spyOn(element, 'getBoundingClientRect').mockReturnValue({
        left: index === 0 ? -10 : 10,
        top: 10,
        right: index === 0 ? 20 : 30,
        bottom: 30,
        width: 30,
        height: 20,
        x: index === 0 ? -10 : 10,
        y: 10,
        toJSON: () => ({}),
      });
    });

    expect(collectRedactionRects()).toEqual([
      { x: 0, y: 10, width: window.innerWidth, height: 20 },
      { x: 0, y: 10, width: window.innerWidth, height: 20 },
      { x: 0, y: 10, width: window.innerWidth, height: 20 },
      { x: 0, y: 10, width: window.innerWidth, height: 20 },
      { x: 0, y: 10, width: window.innerWidth, height: 20 },
    ]);
  });

  it('saves a comment with only the structural element reference', async () => {
    const { onSave, host, root } = openForm();
    const input = root.querySelector('textarea')!;
    input.value = '  Button is clipped  ';
    root
      .querySelector<HTMLFormElement>('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await vi.waitFor(() => expect(onSave).toHaveBeenCalledOnce());
    const saved = onSave.mock.calls[0]![0]!;
    expect(saved.comment).toBe('  Button is clipped  ');
    expect(saved.element.selector).toContain('button:nth-of-type(1)');
    expect(JSON.stringify(saved)).not.toContain('Private page text');
    expect(JSON.stringify(saved)).not.toContain('data-private');
    expect(host.isConnected).toBe(false);
  });

  it('keeps the note and exposes the save failure', async () => {
    const { onSave, root } = openForm();
    onSave.mockRejectedValueOnce(new Error('Local storage is full.'));
    root.querySelector('textarea')!.value = 'Keep this note';
    root
      .querySelector<HTMLFormElement>('form')!
      .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));

    await vi.waitFor(() =>
      expect(root.querySelector('.error')?.textContent).toContain(
        'Local storage is full.',
      ),
    );
    expect(root.querySelector('textarea')!.value).toBe('Keep this note');
  });

  it('closes on Escape or Cancel without saving', () => {
    const first = openForm();
    document.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    expect(first.host.isConnected).toBe(false);

    const second = openForm();
    second.root.querySelector<HTMLButtonElement>('[data-cancel]')!.click();
    expect(second.host.isConnected).toBe(false);
    expect(second.onSave).not.toHaveBeenCalled();
  });
});
