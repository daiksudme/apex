type Link = Pick<HTMLAnchorElement, 'href' | 'target' | 'rel'>;

const addNoopener = (rel: string) => {
  const tokens = new Set(rel.split(/\s+/).filter(Boolean));
  tokens.add('noopener');
  return [...tokens].join(' ');
};

export const externalizeLink = (link: Link, currentOrigin: string) => {
  const url = new URL(link.href, currentOrigin);
  if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.origin === currentOrigin) {
    return;
  }

  link.target = '_blank';
  link.rel = addNoopener(link.rel);
};

export const externalizeDocumentLinks = (
  root: Pick<ParentNode, 'querySelectorAll'>,
  currentOrigin: string,
) => {
  for (const link of root.querySelectorAll<HTMLAnchorElement>('a[href]')) {
    externalizeLink(link, currentOrigin);
  }
};
