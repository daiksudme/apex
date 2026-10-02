type HastNode = {
  type?: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

const isExternalHttpHref = (href: string) =>
  href.startsWith('https://') || href.startsWith('http://');

const withSecurityRel = (rel: unknown) => {
  const tokens = Array.isArray(rel)
    ? rel.map(String)
    : typeof rel === 'string'
      ? rel.split(/\s+/).filter(Boolean)
      : [];

  return [...new Set([...tokens, 'noopener', 'noreferrer'])];
};

export const externalLinks = () => (tree: HastNode) => {
  const visit = (node: HastNode) => {
    if (node.type === 'element' && node.tagName === 'a') {
      const href = node.properties?.href;
      if (typeof href === 'string' && isExternalHttpHref(href)) {
        node.properties ??= {};
        node.properties.target = '_blank';
        node.properties.rel = withSecurityRel(node.properties.rel);
      }
    }

    node.children?.forEach(visit);
  };

  visit(tree);
};
