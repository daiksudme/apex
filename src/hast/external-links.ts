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
      const tokens = new Set(
        Array.isArray(rel)
          ? rel.map(String)
          : typeof rel === 'string'
            ? rel.split(/\s+/).filter(Boolean)
            : [],
      );
      tokens.add('noopener');
      node.properties.rel = [...tokens];
    },
  },
});
