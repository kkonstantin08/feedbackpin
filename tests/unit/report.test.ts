import { describe, expect, it } from 'vitest';
import { createReport, structuralSelector } from '../../src/shared/report';

describe('report privacy and validation', () => {
  it('rejects comments that are empty after trimming', () => {
    expect(() =>
      createReport({
        comment: '  \n ',
        url: 'https://example.test/page?token=secret#section',
        viewport: { width: 1280, height: 720 },
        element: {
          tag: 'button',
          selector: 'html > body > button:nth-of-type(1)',
        },
      }),
    ).toThrow(/comment/i);
  });

  it('stores only the approved fields and removes URL query and fragment', () => {
    const report = createReport({
      comment: '  Broken button  ',
      url: 'https://example.test/page?token=secret#section',
      viewport: { width: 1280, height: 720 },
      element: {
        tag: 'button',
        selector: 'html > body > button:nth-of-type(1)',
      },
    });

    expect(report).toMatchObject({
      comment: 'Broken button',
      url: 'https://example.test/page',
      viewport: { width: 1280, height: 720 },
      element: {
        tag: 'button',
        selector: 'html > body > button:nth-of-type(1)',
      },
      status: 'open',
    });
    expect(Object.keys(report).sort()).toEqual([
      'comment',
      'createdAt',
      'element',
      'id',
      'status',
      'url',
      'viewport',
    ]);
    expect(report.id).toBeTruthy();
    expect(report.createdAt).toBeTypeOf('number');
  });

  it('builds a structural selector without text or arbitrary attributes', () => {
    document.body.innerHTML =
      '<main><button data-secret="value">Private page text</button><button>Other</button></main>';
    const button = document.querySelector('button[data-secret]')!;

    expect(structuralSelector(button)).toEqual({
      tag: 'button',
      selector:
        'html:nth-of-type(1) > body:nth-of-type(1) > main:nth-of-type(1) > button:nth-of-type(1)',
    });
    expect(JSON.stringify(structuralSelector(button))).not.toContain('Private');
    expect(JSON.stringify(structuralSelector(button))).not.toContain('secret');
  });
});
