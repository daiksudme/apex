import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import Pane from './Pane.astro';

describe('pane', () => {
  it('forwards parent scope attributes to the root element', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(Pane, {
      props: {
        class: 'example-pane',
        'data-astro-cid-parent': 'scope',
      },
      slots: {
        default: 'content',
      },
    });

    const root = html.match(/<section\b[^>]*>/)?.[0] ?? '';
    expect(root).toContain('class="pane example-pane"');
    expect(root).toContain('data-astro-cid-parent="scope"');
  });
});
