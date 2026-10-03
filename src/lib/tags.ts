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
  _posts: readonly TagSource[],
  _configuredTags: readonly ConfiguredTag[],
): TagDefinition[] => [];
