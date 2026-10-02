import { describe, expect, it } from 'vitest';
import { externalizeDocumentLinks } from './external-links';

describe('externalizeDocumentLinks', () => {
  it('opens external HTTP links in a new window and preserves existing rel tokens', () => {
    const external = {
      href: 'https://example.com/article',
      target: '',
      rel: 'ugc',
    };
    const internal = {
      href: 'https://example.test/posts/example',
      target: '',
      rel: '',
    };
    const mail = {
      href: 'mailto:hello@example.com',
      target: '',
      rel: '',
    };
    let selector = '';

    const root = {
      querySelectorAll(query: string) {
        selector = query;
        return [external, internal, mail] as unknown as NodeListOf<HTMLAnchorElement>;
      },
    } as Pick<ParentNode, 'querySelectorAll'>;

    externalizeDocumentLinks(root, 'https://example.test');

    expect(selector).toBe('a[href]');
    expect(external).toEqual({
      href: 'https://example.com/article',
      target: '_blank',
      rel: 'ugc noopener',
    });
    expect(internal).toEqual({
      href: 'https://example.test/posts/example',
      target: '',
      rel: '',
    });
    expect(mail).toEqual({
      href: 'mailto:hello@example.com',
      target: '',
      rel: '',
    });
  });
});
