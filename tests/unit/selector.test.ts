import { beforeEach, describe, expect, it, vi } from 'vitest';
import { startSelection } from '../../src/content/selector';

function setTargetAtPointer(target: Element) {
  Object.defineProperty(document, 'elementFromPoint', {
    configurable: true,
    value: vi.fn().mockReturnValue(target),
  });
  vi.spyOn(target, 'getBoundingClientRect').mockReturnValue({
    top: 20,
    left: 30,
    right: 130,
    bottom: 70,
    width: 100,
    height: 50,
    x: 30,
    y: 20,
    toJSON: () => ({}),
  });
}

beforeEach(() => {
  document.body.innerHTML = '<button id="target">Safe page text</button>';
});

describe('on-demand element selection', () => {
  it('highlights the element under the pointer and selects it on click', () => {
    const target = document.querySelector<HTMLButtonElement>('#target')!;
    setTargetAtPointer(target);
    const onSelect = vi.fn();
    startSelection({ onSelect, onCancel: vi.fn() });

    document.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 40, clientY: 30 }),
    );
    const ring = document
      .querySelector('[data-feedbackpin-host]')!
      .shadowRoot!.querySelector('[data-feedbackpin-highlight]') as HTMLElement;
    expect(ring.style.transform).toBe('translate(30px, 20px)');
    expect(ring.style.width).toBe('100px');

    const click = new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      detail: 1,
      clientX: 40,
      clientY: 30,
    });
    document.dispatchEvent(click);
    expect(click.defaultPrevented).toBe(true);
    expect(onSelect).toHaveBeenCalledWith(target);
    expect(document.querySelector('[data-feedbackpin-host]')).toBeNull();
    document.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true }),
    );
    expect(onSelect).toHaveBeenCalledOnce();
  });

  it('cancels on Escape, removes the host, and does not react after cleanup', () => {
    const onCancel = vi.fn();
    const onSelect = vi.fn();
    startSelection({ onSelect, onCancel });

    document.dispatchEvent(
      new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      }),
    );
    expect(onCancel).toHaveBeenCalledOnce();
    expect(document.querySelector('[data-feedbackpin-host]')).toBeNull();
    document.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('supports explicit cancellation, cleans up, and rejects duplicate sessions', () => {
    const onCancel = vi.fn();
    const session = startSelection({ onSelect: vi.fn(), onCancel });
    expect(() =>
      startSelection({ onSelect: vi.fn(), onCancel: vi.fn() }),
    ).toThrow(/already active/i);

    session.cancel();
    session.cancel();
    expect(onCancel).toHaveBeenCalledOnce();
    expect(document.querySelector('[data-feedbackpin-host]')).toBeNull();
  });

  it('removes every temporary document listener when selection is cancelled', () => {
    const removed = vi.spyOn(document, 'removeEventListener');
    const session = startSelection({ onSelect: vi.fn(), onCancel: vi.fn() });

    session.cancel();

    expect(removed).toHaveBeenCalledWith(
      'pointermove',
      expect.any(Function),
      true,
    );
    expect(removed).toHaveBeenCalledWith('click', expect.any(Function), true);
    expect(removed).toHaveBeenCalledWith('keydown', expect.any(Function), true);
  });

  it('uses the keyboard-activated element instead of a pointer coordinate', () => {
    const target = document.querySelector<HTMLButtonElement>('#target')!;
    const wrong = document.createElement('aside');
    document.body.append(wrong);
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: () => wrong,
    });
    const onSelect = vi.fn();
    startSelection({ onSelect, onCancel: vi.fn() });

    target.click();

    expect(onSelect).toHaveBeenCalledWith(target);
  });
});
