---
type: Reference
title: Blog terminology
description: Terms for post classification, subscription, and article navigation.
---

## Post classification

| Term | Definition | Model boundary | Code name |
| --- | --- | --- | --- |
| Tag definition | An identifier and display color available for posts. Definition order in YAML has no meaning | Blog post classification | TagDefinition |
| Used tag | A tag definition referenced by at least one post | Blog post classification | deriveUsedTags |
| Tag reference | A tag identifier specified by a post. An undefined identifier causes a build error | Blog post classification | posts.data.tags |

See [post tag definitions and references](behavior/tags.feature.md) for details.

## RSS subscription

| Term | Definition | Model boundary | Code name |
| --- | --- | --- | --- |
| RSS feed | Static subscription document containing site metadata and one item per listed post, including Profile | Blog subscription | `/rss.xml` |
| Summary | Post description supplied to a feed reader, without the full article body | Blog subscription | `description` |
| Feed identity | Stable identifier equal to the absolute production article URL; unchanged by summary or update-date edits | Blog subscription | `guid` |
| Production origin | Selected `https://daiksud.me` origin used for absolute subscription URLs in every build environment | Site publishing | Astro `site` |

See [RSS subscription and discovery](features/rss.feature.md) for details.

## Article navigation

| Term | Definition | Model boundary | Code name |
| --- | --- | --- | --- |
| Table of contents | Static list of article section links shown when at least two eligible headings exist | Article reading | `tocHeadings` |
| Eligible heading | Body h2 or h3 heading; its label and ID come from the existing Markdown renderer | Article reading | `headings` |

See [article table of contents](features/table-of-contents.feature.md) for details.
