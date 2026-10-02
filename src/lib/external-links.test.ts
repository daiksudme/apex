import { describe, expect, it } from 'vitest';
import { externalLinks } from './external-links';

describe('externalLinks', () => {
  it('opens external HTTP links in a new window and preserves existing rel tokens', () => {
    const external = {
      type: 'element',
      tagName: 'a',
      properties: {
        href: 'https://example.com/article',
        rel: ['ugc'],
      },
      children: [],
    };
    const internal = {
      type: 'element',
      tagName: 'a',
      properties: {
        href: '/posts/example',
      },
      children: [],
    };
    const tree = {
      type: 'root',
      children: [external, internal],
    };

    externalLinks()(tree);

    expect(external.properties).toEqual({
      href: 'https://example.com/article',
      target: '_blank',
      rel: ['ugc', 'noopener', 'noreferrer'],
    });
    expect(internal.properties).toEqual({
      href: '/posts/example',
    });
  });
});
