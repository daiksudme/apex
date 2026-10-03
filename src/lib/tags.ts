import { tags as configuredTags } from '../config/site';

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
): TagDefinition[] => {
  const toneBySlug = new Map<string, string>(
    configuredTags.map((tag) => [tag.slug, tag.tone]),
  );

  return [...new Set(posts.flatMap((post) => post.data.tags))].map((slug) => ({
    slug,
    tone: toneBySlug.get(slug) ?? 'muted',
  }));
};

export const orderTagsByConfiguration = (
  usedTags: readonly TagDefinition[],
): TagDefinition[] => {
  const usedTagBySlug = new Map(usedTags.map((tag) => [tag.slug, tag]));
  const configuredTagSlugs = new Set<string>(configuredTags.map((tag) => tag.slug));
  const configuredTagDefinitions = configuredTags.flatMap((configuredTag) => {
    const tag = usedTagBySlug.get(configuredTag.slug);
    return tag ? [tag] : [];
  });
  const extraTagDefinitions = usedTags
    .filter((tag) => !configuredTagSlugs.has(tag.slug))
    .sort((a, b) => a.slug.localeCompare(b.slug));

  return [...configuredTagDefinitions, ...extraTagDefinitions];
};
