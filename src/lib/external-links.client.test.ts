import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

describe('external links client integration', () => {
  it('externalizes a rendered article link when the client module loads', async () => {
    const articleLink = {
      href: 'https://example.com/article',
      target: '',
      rel: 'ugc',
    };
    let selector = '';

    vi.stubGlobal('document', {
      querySelectorAll(query: string) {
        selector = query;
        return [articleLink] as unknown as NodeListOf<HTMLAnchorElement>;
      },
    });
    vi.stubGlobal('window', {
      location: {
        origin: 'https://example.test',
      },
    });

    await import('./external-links.client');

    expect(selector).toBe('a[href]');
    expect(articleLink).toEqual({
      href: 'https://example.com/article',
      target: '_blank',
      rel: 'ugc noopener',
    });
  });
});
