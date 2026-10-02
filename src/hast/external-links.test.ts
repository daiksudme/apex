import { markdownToHtml } from 'satteri';
import { describe, expect, it } from 'vitest';
import { hastExternalLinks } from './external-links';

describe('Markdown external links', () => {
  it('renders external links in a new window with noopener', () => {
    const { html } = markdownToHtml(
      [
        '[GitHub](https://github.com/daiksud)',
        '[Zenn](https://zenn.dev/daiksud)',
        '[X](https://x.com/daiksud)',
        '[Internal](/posts/example)',
      ].join('\n\n'),
      {
        hastPlugins: [hastExternalLinks],
      },
    );

    for (const href of [
      'https://github.com/daiksud',
      'https://zenn.dev/daiksud',
      'https://x.com/daiksud',
    ]) {
      const anchor = [...html.matchAll(/<a\b[^>]*>/g)]
        .map((match) => match[0])
        .find((tag) => tag.includes(`href="${href}"`));
      expect(anchor).toBeDefined();
      expect(anchor).toContain('target="_blank"');
      expect(anchor).toContain('rel="noopener"');
      expect(anchor).not.toContain('noreferrer');
    }

    const internal = [...html.matchAll(/<a\b[^>]*>/g)]
      .map((match) => match[0])
      .find((tag) => tag.includes('href="/posts/example"'));
    expect(internal).toBeDefined();
    expect(internal).not.toContain('target="_blank"');
    expect(internal).not.toContain('rel="noopener"');
  });
});
