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

export const orderTagsByPostCount = (
  usedTags: readonly TagDefinition[],
  posts: readonly TagSource[],
): TagDefinition[] => {
  const postCountBySlug = new Map<string, number>();

  for (const post of posts) {
    for (const slug of new Set(post.data.tags)) {
      postCountBySlug.set(slug, (postCountBySlug.get(slug) ?? 0) + 1);
    }
  }

  return [...usedTags].sort((left, right) => {
    const countDifference =
      (postCountBySlug.get(right.slug) ?? 0) - (postCountBySlug.get(left.slug) ?? 0);
    return countDifference || left.slug.localeCompare(right.slug);
  });
};
