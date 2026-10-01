import { experimental_AstroContainer as AstroContainer } from 'astro/container';
import { describe, expect, it } from 'vitest';
import TerminalPrompt from './TerminalPrompt.astro';

describe('terminal prompt', () => {
  it('uses the home directory by default', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(TerminalPrompt);

    expect(html).toContain('daiksud');
    expect(html).toContain('kawasaki');
    expect(html).toContain(':~$');
  });

  it('can display the current path', async () => {
    const container = await AstroContainer.create();
    const html = await container.renderToString(TerminalPrompt, {
      props: { path: '~/posts' },
    });

    expect(html).toContain(':~/posts$');
  });
});
