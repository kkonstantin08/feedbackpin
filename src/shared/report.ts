export interface Viewport {
  width: number;
  height: number;
}

export interface ElementReference {
  tag: string;
  selector: string;
}

export interface NewReport {
  comment: string;
  url: string;
  viewport: Viewport;
  element: ElementReference;
}

export interface Report extends NewReport {
  screenshot?: Blob;
  screenshotError?: string;
  id: string;
  createdAt: number;
  status: 'open' | 'resolved';
}

export function createReport(input: NewReport): Report {
  if (!input || typeof input !== 'object')
    throw new Error('Report data is invalid.');
  if (typeof input.comment !== 'string')
    throw new Error('Comment must be text.');
  if (typeof input.url !== 'string') throw new Error('Page URL is invalid.');
  if (!input.viewport || !input.element)
    throw new Error('Report data is incomplete.');
  const comment = input.comment.trim();
  if (!comment) throw new Error('Comment cannot be empty.');
  const url = new URL(input.url);
  if (url.protocol !== 'http:' && url.protocol !== 'https:')
    throw new Error('Only web page URLs can be reported.');
  url.search = '';
  url.hash = '';
  url.username = '';
  url.password = '';
  if (
    !Number.isInteger(input.viewport.width) ||
    input.viewport.width < 1 ||
    !Number.isInteger(input.viewport.height) ||
    input.viewport.height < 1
  ) {
    throw new Error('Viewport dimensions must be positive integers.');
  }
  if (
    typeof input.element.tag !== 'string' ||
    typeof input.element.selector !== 'string' ||
    !/^[a-z][a-z\d-]*$/i.test(input.element.tag) ||
    !input.element.selector.trim()
  ) {
    throw new Error('Element reference is invalid.');
  }

  const report: Report = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    comment,
    url: url.href,
    viewport: { width: input.viewport.width, height: input.viewport.height },
    element: {
      tag: input.element.tag.toLowerCase(),
      selector: input.element.selector,
    },
    status: 'open',
  };
  return report;
}

export function structuralSelector(element: Element): ElementReference {
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
