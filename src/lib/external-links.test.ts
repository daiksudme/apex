import { describe, expect, it } from 'vitest';
import { openExternalHttpLink } from './external-links';

describe('openExternalHttpLink', () => {
  it('opens an external HTTP link in a new window and preserves existing rel tokens', () => {
    const link = {
      href: 'https://example.com/article',
      target: '',
      rel: 'ugc',
    };

    openExternalHttpLink(link, 'https://example.test');

    expect(link).toEqual({
      href: 'https://example.com/article',
      target: '_blank',
      rel: 'ugc noopener noreferrer',
    });
  });

  it('leaves internal and non-HTTP links unchanged', () => {
    for (const href of ['/posts/example', 'mailto:hello@example.com']) {
      const link = { href, target: '', rel: '' };

      openExternalHttpLink(link, 'https://example.test');

      expect(link).toEqual({ href, target: '', rel: '' });
    }
  });
});
