export interface SelectionCallbacks {
  onSelect: (element: Element) => void;
  onCancel: () => void;
}

export interface SelectionSession {
  cancel: () => void;
}

let activeCleanup: (() => void) | undefined;

export function startSelection(
  callbacks: SelectionCallbacks,
): SelectionSession {
  if (activeCleanup)
    throw new Error('FeedbackPin selection is already active.');

  const host = document.createElement('div');
  host.setAttribute('data-feedbackpin-host', '');
  host.style.cssText =
    'all:initial;position:fixed;inset:0;z-index:2147483647;pointer-events:none;';
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML =
    '<style>[data-feedbackpin-highlight]{position:fixed;display:none;pointer-events:none;box-sizing:border-box;border:2px solid #6554c0;background:rgba(101,84,192,.08);border-radius:2px}</style><div data-feedbackpin-highlight aria-hidden="true"></div>';
  const highlight = shadow.querySelector<HTMLElement>(
    '[data-feedbackpin-highlight]',
  )!;
  document.documentElement.append(host);

  let finished = false;
  const cleanup = () => {
    if (finished) return;
    finished = true;
    document.removeEventListener('pointermove', onPointerMove, true);
    document.removeEventListener('click', onClick, true);
    document.removeEventListener('keydown', onKeyDown, true);
    host.remove();
    if (activeCleanup === cleanup) activeCleanup = undefined;
  };
  const onPointerMove = (event: PointerEvent) => {
    const target = document.elementFromPoint(event.clientX, event.clientY);
    if (!target || host.contains(target)) {
      highlight.style.display = 'none';
      return;
    }
    const rect = target.getBoundingClientRect();
    highlight.style.display = 'block';
    highlight.style.transform = `translate(${rect.left}px, ${rect.top}px)`;
    highlight.style.width = `${rect.width}px`;
    highlight.style.height = `${rect.height}px`;
  };
  const onClick = (event: MouseEvent) => {
    if (event.composedPath().includes(host)) return;
    const underPointer = document.elementFromPoint(
      event.clientX,
      event.clientY,
    );
    const target =
      underPointer && !host.contains(underPointer)
        ? underPointer
        : event.target instanceof Element && !host.contains(event.target)
          ? event.target
          : null;
    if (!target) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    cleanup();
    callbacks.onSelect(target);
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Escape') return;
    event.preventDefault();
    event.stopImmediatePropagation();
    cleanup();
    callbacks.onCancel();
  };

  activeCleanup = cleanup;
  document.addEventListener('pointermove', onPointerMove, {
    capture: true,
    passive: true,
  });
  document.addEventListener('click', onClick, true);
  document.addEventListener('keydown', onKeyDown, true);
  return {
    cancel: () => {
      if (finished) return;
      cleanup();
      callbacks.onCancel();
    },
  };
}
