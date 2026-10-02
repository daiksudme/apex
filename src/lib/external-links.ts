type LinkLike = {
  href: string;
  target: string;
  rel: string;
};

export const openExternalHttpLink = (link: LinkLike, currentOrigin: string) => {
  const url = new URL(link.href, currentOrigin);
  if ((url.protocol !== 'http:' && url.protocol !== 'https:') || url.origin === currentOrigin) {
    return;
  }

  link.target = '_blank';

  const rel = new Set(link.rel.split(/\s+/).filter(Boolean));
  rel.add('noopener');
  rel.add('noreferrer');
  link.rel = [...rel].join(' ');
};
