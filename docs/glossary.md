---
type: Reference
title: Blog terminology
description: Terms for tags used to classify posts and for what is displayed.
---

## Post classification

| Term | Definition | Model boundary | Code name |
| --- | --- | --- | --- |
| Tag definition | An identifier and display color available for posts. Definition order in YAML has no meaning | Blog post classification | TagDefinition |
| Used tag | A tag definition referenced by at least one post | Blog post classification | deriveUsedTags |
| Tag reference | A tag identifier specified by a post. An undefined identifier causes a build error | Blog post classification | posts.data.tags |

See [post tag definitions and references](behavior/tags.feature.md) for details.
