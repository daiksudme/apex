import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { getCollection, render } from 'astro:content';
import { describe, expect, it } from 'vitest';

describe('Markdown external links', () => {
  it('renders article external links in a new window with noopener', async () => {
    const posts = await getCollection('posts');
    const post = posts.find((entry) => entry.id === 'hello-daiksud');
    expect(post).toBeDefined();

    const { Content } = await render(post!);
    const container = await AstroContainer.create();
    const html = await container.renderToString(Content);

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
  });
});
