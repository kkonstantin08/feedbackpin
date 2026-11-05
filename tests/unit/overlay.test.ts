import { afterEach, describe, expect, it, vi } from 'vitest';
import { showReportForm } from '../../src/content/overlay';

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
  showReportForm(target, { onSave });
  const host = document.querySelector('[data-feedbackpin-host]')!;
  return { onSave, host, root: host.shadowRoot! };
}

describe('on-page report form', () => {
  it('explains that screenshots are disabled and does not offer image capture', () => {
    const target = document.createElement('button');
    showReportForm(target, { onSave: vi.fn() });
    const root = document.querySelector('[data-feedbackpin-host]')!.shadowRoot!;

    expect(root.querySelector('[data-capture]')).toBeNull();
    expect(root.textContent).toMatch(/screenshots are disabled for privacy/i);
  });

  it('saves a comment with only the structural element reference', async () => {
    const { onSave, host, root } = openForm();
    root.querySelector('textarea')!.value = '  Button is clipped  ';
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

  it('removes its temporary key, submit, and cancel listeners when closed', () => {
    const documentRemove = vi.spyOn(document, 'removeEventListener');
    const formRemove = vi.spyOn(
      HTMLFormElement.prototype,
      'removeEventListener',
    );
    const buttonRemove = vi.spyOn(
      HTMLButtonElement.prototype,
      'removeEventListener',
    );
    const { host } = openForm();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));

    expect(documentRemove).toHaveBeenCalledWith(
      'keydown',
      expect.any(Function),
      true,
    );
    expect(formRemove).toHaveBeenCalledWith('submit', expect.any(Function));
    expect(buttonRemove).toHaveBeenCalledWith('click', expect.any(Function));
    expect(host.isConnected).toBe(false);
  });
});
