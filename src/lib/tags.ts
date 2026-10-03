export interface TagDefinition {
  slug: string;
  tone: string;
}

interface TagSource {
  data: {
    tags: readonly string[];
  };
}

interface ConfiguredTag {
  slug: string;
  tone: string;
}

export const deriveUsedTags = (
  posts: readonly TagSource[],
  configuredTags: readonly ConfiguredTag[],
): TagDefinition[] => {
  const toneBySlug = new Map(configuredTags.map((tag) => [tag.slug, tag.tone]));

  return [...new Set(posts.flatMap((post) => post.data.tags))].map((slug) => ({
    slug,
    tone: toneBySlug.get(slug) ?? 'muted',
  }));
};

export const orderTagsByConfiguration = (
  usedTags: readonly TagDefinition[],
  _configuredTags: readonly ConfiguredTag[],
): TagDefinition[] => [...usedTags];
