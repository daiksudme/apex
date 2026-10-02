import { describe, expect, it } from 'vitest';
import { externalizeHtmlLinks } from './external-links';

describe('externalizeHtmlLinks', () => {
  it('opens external HTTP links in a new window and preserves existing rel tokens', () => {
    const html = '<p><a href="https://example.com/article" rel="ugc">Example</a></p>';

    expect(externalizeHtmlLinks(html)).toContain(
      '<a href="https://example.com/article" rel="ugc noopener" target="_blank">',
    );
  });

  it('leaves internal and non-HTTP links unchanged', () => {
    const html = '<a href="/posts/example">Internal</a><a href="mailto:hello@example.com">Mail</a>';

    expect(externalizeHtmlLinks(html)).toBe(html);
  });
});
