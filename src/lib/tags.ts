export interface TagDefinition {
  slug: string;
  tone: string;
}

interface TagSource {
  id: string;
  data: {
    tags: readonly string[];
  };
}

export const deriveUsedTags = (
  posts: readonly TagSource[],
  definitions: readonly TagDefinition[],
): TagDefinition[] => {
  const definitionBySlug = new Map(definitions.map((tag) => [tag.slug, tag]));
  const usedTags = new Map<string, TagDefinition>();

  for (const post of posts) {
    for (const slug of post.data.tags) {
      const definition = definitionBySlug.get(slug);
      if (!definition) {
        throw new Error(`Post "${post.id}" references undefined tag "${slug}" in src/content/tags.yaml`);
      }
      usedTags.set(slug, definition);
    }
  }

  return [...usedTags.values()];
};

export const orderTagsByDefinition = (
  usedTags: readonly TagDefinition[],
  definitions: readonly TagDefinition[],
): TagDefinition[] => {
  const usedSlugs = new Set(usedTags.map((tag) => tag.slug));
  return definitions.filter((tag) => usedSlugs.has(tag.slug));
};
