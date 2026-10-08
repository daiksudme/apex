---
type: Feature
title: Reader tag navigation
description: Acceptance criteria for finding posts through tag index links.
---

## Feature: Readers find posts by tag

### Scenario: TAG-01 Follow a used tag to its posts

- Given: a tag is used by a published post
- When: the reader follows a tag link from Home or a post
- Then: the tag index opens at that tag's unique heading
- And: a listed post link opens the corresponding root-level post route
- And: the post retains its title and tag links

Browser verification traces TAG-01 in [reader.browser.mjs](../../tests/acceptance/reader.browser.mjs). Author tag definitions, ordering, unused tags, and invalid references remain specified in [post tag definitions and references](../behavior/tags.feature.md) and verified with isolated fixture builds.
