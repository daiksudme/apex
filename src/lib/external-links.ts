const isExternalHttpHref = (href: string) =>
  href.startsWith('https://') || href.startsWith('http://');

const withSecurityRel = (rel: string | undefined) => {
  const tokens = new Set((rel ?? '').split(/\s+/).filter(Boolean));
  tokens.add('noopener');
  return [...tokens].join(' ');
};

export const externalizeHtmlLinks = (html: string) =>
  html.replace(/<a\b[^>]*>/gi, (tag) => {
    const href = tag.match(/\bhref=(["'])(.*?)\1/i)?.[2];
    if (!href || !isExternalHttpHref(href)) {
      return tag;
    }

    let nextTag = /\btarget=(["']).*?\1/i.test(tag)
      ? tag.replace(/\btarget=(["']).*?\1/i, 'target="_blank"')
      : tag.replace(/>$/, ' target="_blank">');

    const rel = nextTag.match(/\brel=(["'])(.*?)\1/i)?.[2];
    const securedRel = withSecurityRel(rel);
    nextTag = /\brel=(["']).*?\1/i.test(nextTag)
      ? nextTag.replace(/\brel=(["']).*?\1/i, `rel="${securedRel}"`)
      : nextTag.replace(/>$/, ` rel="${securedRel}">`);

    return nextTag;
  });
