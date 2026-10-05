---
type: Specification
title: Post tag definitions and references
description: YAML tag definitions, validation of post references, and display rules for used tags.
---

## Feature: Define the tags available for posts

Post authors can define available tags and prevent posts with undefined tags from being published by rejecting them at build time. Readers can use the same tag colors and link destinations on each page.

### Rule: Tag definitions are the source of truth

Manage tag identifiers and display colors in `src/content/tags.yaml`. Posts reference the identifiers. The same identifier cannot be defined more than once. Definition order in YAML has no meaning.

#### Scenario: Publish a post with a defined tag

- Given: the display color of the `sample` tag is defined as `blue`
- And: a post specifies `sample`
- When: the site is built
- Then: the build succeeds
- And: `sample` appears in `blue` in the tag index and sidebar

#### Scenario: Define the same identifier more than once

- Given: the tag definitions contain two entries for `sample` with different colors
- When: the site is built
- Then: the build fails
- And: the error identifies the duplicated `sample`

### Rule: A post with undefined tags causes the build to fail

#### Scenario: An older post has an undefined tag

- Given: the latest three posts specify only defined tags
- And: an older post specifies the undefined tag `unknown`
- When: the site is built
- Then: the build fails
- And: the error identifies the affected post and `unknown`

### Rule: Display only tags in use

#### Scenario: A defined tag is unused

- Given: `sample` and `unused` are defined
- And: multiple posts specify only `sample`
- When: the tag index is displayed
- Then: `sample` appears only once
- And: `unused` does not appear

When there are no posts, no tags are displayed either. Home, the tag index, and the sidebar order tags by descending number of posts referencing them, with ties broken by ascending identifier. Each tag displays its latest three posts in descending publication-date order. Each tag link points to `/tags#tag-<identifier>`.

## Verification data

Automated tests use dedicated tag definitions and post fixtures. Do not use published posts or production tag definitions as test input; generated HTML verification also runs in a temporary project.
