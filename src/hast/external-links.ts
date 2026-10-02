import { defineHastPlugin } from 'satteri';

export const hastExternalLinks = defineHastPlugin({
  name: 'external-links',
  element: {
    filter: ['a'],
    visit(node) {
      const href = node.properties.href;
      if (typeof href !== 'string' || (!href.startsWith('https://') && !href.startsWith('http://'))) {
        return;
      }

      node.properties.target = '_blank';

      const rel = node.properties.rel;
      const tokens = new Set<string>(
        Array.isArray(rel)
          ? rel.filter((token): token is string => typeof token === 'string')
          : [],
      );
      tokens.add('noopener');
      node.properties.rel = [...tokens];
    },
  },
});
