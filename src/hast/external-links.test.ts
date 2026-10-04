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
        '[Internal](/example)',
        '<a href="https://example.com/raw" rel="ugc">Raw external</a>',
        '[Uppercase scheme](HTTPS://example.com/uppercase)',
      ].join('\n\n'),
      {
        features: { rawHtml: true },
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

    const uppercaseScheme = [...html.matchAll(/<a\b[^>]*>/g)]
      .map((match) => match[0])
      .find((tag) => tag.includes('href="HTTPS://example.com/uppercase"'));
    expect(uppercaseScheme).toBeDefined();
    expect(uppercaseScheme).toContain('target="_blank"');
    expect(uppercaseScheme).toContain('rel="noopener"');
    expect(uppercaseScheme).not.toContain('noreferrer');

    const rawExternal = [...html.matchAll(/<a\b[^>]*>/g)]
      .map((match) => match[0])
      .find((tag) => tag.includes('href="https://example.com/raw"'));
    expect(rawExternal).toBeDefined();
    expect(rawExternal).toContain('target="_blank"');
    expect(rawExternal).toContain('rel="ugc noopener"');
    expect(rawExternal).not.toContain('noreferrer');

    const internal = [...html.matchAll(/<a\b[^>]*>/g)]
      .map((match) => match[0])
      .find((tag) => tag.includes('href="/example"'));
    expect(internal).toBeDefined();
    expect(internal).not.toContain('target="_blank"');
    expect(internal).not.toContain('rel="noopener"');
  });
});
