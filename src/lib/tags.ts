export interface TagDefinition {
  slug: string;
  tone: string;
}

interface TagSource {
  data: {
    tags: readonly string[];
  };
}

export const deriveUsedTags = (
  posts: readonly TagSource[],
  definitions: readonly TagDefinition[],
): TagDefinition[] => {
  const toneBySlug = new Map<string, string>(
    definitions.map((tag) => [tag.slug, tag.tone]),
  );

  return [...new Set(posts.flatMap((post) => post.data.tags))].map((slug) => ({
    slug,
    tone: toneBySlug.get(slug) ?? 'muted',
  }));
};

export const orderTagsByDefinition = (
  usedTags: readonly TagDefinition[],
  definitions: readonly TagDefinition[],
): TagDefinition[] => {
  const usedTagBySlug = new Map(usedTags.map((tag) => [tag.slug, tag]));
  const configuredTagSlugs = new Set<string>(definitions.map((tag) => tag.slug));
  const configuredTagDefinitions = definitions.flatMap((configuredTag) => {
    const tag = usedTagBySlug.get(configuredTag.slug);
    return tag ? [tag] : [];
  });
  const extraTagDefinitions = usedTags
    .filter((tag) => !configuredTagSlugs.has(tag.slug))
    .sort((a, b) => a.slug.localeCompare(b.slug));

  return [...configuredTagDefinitions, ...extraTagDefinitions];
};
