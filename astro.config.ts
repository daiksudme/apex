import { satteri } from '@astrojs/markdown-satteri';
import { defineConfig } from 'astro/config';
import { hastExternalLinks } from './src/hast/external-links';

export default defineConfig({
  trailingSlash: 'never',
  markdown: {
    processor: satteri({
      features: { rawHtml: true },
      hastPlugins: [hastExternalLinks],
    }),
  },
});
