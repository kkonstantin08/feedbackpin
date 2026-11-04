function structuralSelector(element: Element) {
  const path: string[] = [];
  let current: Element | null = element;
  while (current) {
    let index = 1;
    for (
      let sibling = current.previousElementSibling;
      sibling;
      sibling = sibling.previousElementSibling
    ) {
      if (sibling.localName === current.localName) index += 1;
    }
    path.unshift(`${current.localName}:nth-of-type(${index})`);
    current = current.parentElement;
  }
  return { tag: element.localName, selector: path.join(' > ') };
}

const styles = `
  :host { all: initial; position: fixed; inset: 0; z-index: 2147483647; pointer-events: none; color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  * { box-sizing: border-box; }
  .host { position: fixed; inset: 0; z-index: 2147483647; pointer-events: none; }
  .card { position: fixed; right: 20px; bottom: 20px; width: min(352px, calc(100vw - 32px)); pointer-events: auto; overflow: hidden; border: 1px solid #e7e5ee; border-radius: 12px; background: #fff; color: #24232c; box-shadow: 0 12px 40px rgb(30 27 50 / 18%); }
  .head { display: flex; align-items: center; gap: 9px; padding: 14px 15px 12px; border-bottom: 1px solid #efedf3; }
  .pin { display: grid; width: 27px; height: 27px; place-items: center; border-radius: 8px; color: #fff; background: #6554c0; font-size: 14px; }
  .title { margin: 0; font-size: 13px; font-weight: 650; letter-spacing: -.1px; }
  .target { margin: 3px 0 0; max-width: 260px; overflow: hidden; color: #777582; font: 10px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; text-overflow: ellipsis; white-space: nowrap; }
  form { padding: 13px 15px 14px; }
  label { display: block; margin: 0 0 6px; color: #595764; font-size: 11px; font-weight: 600; }
  textarea { display: block; width: 100%; min-height: 83px; resize: vertical; border: 1px solid #dfdde7; border-radius: 8px; padding: 9px 10px; background: #fff; color: #24232c; font-family: inherit; font-size: 12px; line-height: 1.5; outline: none; }
  textarea:focus { border-color: #7768cc; box-shadow: 0 0 0 3px rgb(101 84 192 / 14%); }
  textarea::placeholder { color: #a19fab; }
  .privacy { margin: 8px 0 12px; color: #85838f; font-size: 10px; line-height: 1.4; }
  .screenshot-disabled { margin: 0 0 12px; color: #777582; font-size: 10px; line-height: 1.4; }
  .actions { display: flex; justify-content: flex-end; gap: 8px; }
  button { min-height: 33px; border: 1px solid #e2e0e9; border-radius: 7px; padding: 0 11px; background: #fff; color: #5e5c69; font-family: inherit; font-size: 11px; font-weight: 600; cursor: pointer; }
  button.primary { border-color: #6554c0; color: #fff; background: #6554c0; }
  button:hover:not(:disabled) { filter: brightness(.97); }
  button:focus-visible { outline: 3px solid #bbb2f0; outline-offset: 2px; }
  button:disabled { cursor: wait; opacity: .62; }
  .error { margin: 0 0 10px; border-radius: 6px; padding: 7px 8px; color: #973c46; background: #fff1f0; font-size: 10px; line-height: 1.4; }
  @media (max-width: 420px) { .card { right: 12px; bottom: 12px; } }
`;

export interface ReportFormData {
  comment: string;
  url: string;
  viewport: { width: number; height: number };
  element: { tag: string; selector: string };
}

export interface ReportFormOptions {
  onSave: (report: ReportFormData) => Promise<void>;
}

export function showReportForm(
  target: Element,
  options: ReportFormOptions,
): () => void {
  const host = document.createElement('div');
  host.setAttribute('data-feedbackpin-host', '');
  const shadow = host.attachShadow({ mode: 'open' });
  const reference = structuralSelector(target);
  const shell = document.createElement('div');
  shell.className = 'host';
  shell.innerHTML = `
    <style>${styles}</style>
    <section class="card" role="dialog" aria-labelledby="feedbackpin-title">
      <header class="head"><span class="pin" aria-hidden="true">●</span><div><h2 class="title" id="feedbackpin-title">Add a note</h2><p class="target"></p></div></header>
      <form><label for="feedbackpin-comment">What needs attention?</label><textarea id="feedbackpin-comment" required placeholder="Describe what you expected…"></textarea><p class="privacy">Page text and form values stay out of the report.</p><p class="screenshot-disabled" role="note">Screenshots are disabled for privacy. You can still save this note.</p><p class="error" role="alert" hidden></p><div class="actions"><button type="button" data-cancel>Cancel</button><button class="primary" type="submit">Save note</button></div></form>
    </section>`;
  shadow.append(shell);
  shell.querySelector('.target')!.textContent =
    `${reference.tag} · ${reference.selector}`;
  document.documentElement.append(host);

  const form = shell.querySelector('form')!;
  const comment = shell.querySelector('textarea')!;
  const save = shell.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const error = shell.querySelector<HTMLElement>('.error')!;
  const closeButton = shell.querySelector<HTMLButtonElement>('[data-cancel]')!;
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    document.removeEventListener('keydown', onKeyDown, true);
    closeButton.removeEventListener('click', onCancel);
    form.removeEventListener('submit', onSubmit);
    host.remove();
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    }
  };
  const onCancel = () => close();
  const onSubmit = async (event: SubmitEvent) => {
    event.preventDefault();
    if (!comment.value.trim() || save.disabled) return;
    save.disabled = true;
    error.hidden = true;
    try {
      await options.onSave({
        comment: comment.value,
        url: location.href,
        viewport: { width: window.innerWidth, height: window.innerHeight },
        element: reference,
      });
      close();
    } catch (cause) {
      error.textContent =
        cause instanceof Error
          ? cause.message
          : 'Could not save this report. Try again.';
      error.hidden = false;
      save.disabled = false;
    }
  };

  closeButton.addEventListener('click', onCancel);
  form.addEventListener('submit', onSubmit);
  document.addEventListener('keydown', onKeyDown, true);
  comment.focus();
  return close;
}
