---
type: Feature
title: Preview minimum operability
description: Route-specific deployed smoke expectations for the commit stage.
---

## Feature: Maintainers validate the deployed Preview before review

### Scenario: SMOKE-01 Reject an unrelated fallback page

- Given: the Preview responds successfully to `/posts`
- And: the response contains Posts in shared navigation but Home content in main
- When: commit-stage checks the deployed route
- Then: the route fails its smoke check because its Posts heading is absent from main

### Scenario: SMOKE-02 Validate all four site routes

- Given: the recorded Preview belongs to the current PR source head and branch
- When: commit-stage fetches `/`, `/posts`, `/tags`, and `/profile`
- Then: every response succeeds and contains its route-specific semantic main content
- And: a provider error or unrelated fallback page does not count as operable

These scenarios specify deployed operability, not detailed reader journeys. Navigation, posts, tags, and profile behavior remain defined by the existing reader specifications until their acceptance scenarios are adapted into this directory.
