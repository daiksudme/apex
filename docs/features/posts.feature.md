---
type: Feature
title: Individual post routes and shared presentation
description: Acceptance criteria for reading posts and the profile at root-level routes and navigating from the post and tag indexes.
---

## Feature: Read individual posts at root-level routes

Readers can read posts and the profile with the same presentation and navigate to them from the post and tag indexes.

### Rule: The filename determines the individual post route

#### Scenario: POST-01 Navigate to multiple posts

- Given: `fixture-post.md` and `second-post.md` exist
- When: the site is generated
- Then: the posts can be read at `/fixture-post` and `/second-post`
- And: Home, the post index, the tag index, and internal body links reference the new URLs
- And: no pages or redirects are generated at `/posts/<slug>`
- And: the `/posts` and `/tags` indexes are retained
- And: individual posts show the Posts navigation item as selected, without identifying the index as the current page

#### Scenario: POST-02 A post name conflicts with an existing route

- Given: `posts.md` or `tags.md` exists
- When: the site is generated
- Then: the build fails with the affected post name and does not overwrite the existing index

### Rule: The profile is also presented as a shared post

#### Scenario: POST-03 Read the profile

- Given: the approved introduction article is renamed to `profile.md`, preserving its body and frontmatter
- When: the reader navigates from the Profile menu
- Then: the article can be read at `/profile`
- And: it follows the same date, tag, and listing rules as other posts
- And: Home's short introduction is retained as the About pane, with a link to the detailed Profile

#### Scenario: POST-04 Read the beginning of a post

- Given: `fixture-post.md` and `profile.md` exist
- When: the reader views each post
- Then: the post pane's Post heading is not displayed
- And: the first terminal lines are `cat fixture-post.md` and `cat profile.md`, respectively
- And: the post title heading and accessible post name are preserved

Build success and rejection contracts correspond to [content.build.test.mjs](../../tests/content.build.test.mjs). Its fixture browser check observes readable Markdown, metadata, tag lists, internal article links, and the absence of old nested routes.

Browser verification traces POST-01, POST-03, and POST-04 in [reader.browser.mjs](../../tests/acceptance/reader.browser.mjs). Fixture build tests retain POST-02 and invalid tag coverage; deployed journeys choose links from the actual indexes rather than assume fixture content is published.
