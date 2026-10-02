import { defineConfig } from 'astro/config';
import { externalLinks } from './src/lib/external-links';

export default defineConfig({
  markdown: {
    rehypePlugins: [externalLinks],
  },
});
