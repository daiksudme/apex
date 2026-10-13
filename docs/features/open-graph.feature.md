---
type: Feature
title: Shared link previews
description: Shared pages expose static Open Graph metadata and a common branded image.
---

## Feature: Share a recognizable page

Readers sharing a site or article URL provide consumers with a meaningful title, summary, and representative image without executing JavaScript.

### Scenario: OG-01 Identify each shared page

- Given: Home, Posts, Tags, Profile, and article pages
- When: a consumer parses the generated HTML head
- Then: exactly one title, description, type, URL, and site name property describes that page
- And: title and description reuse the existing page values, including site defaults
- And: Home, Posts, and Tags use `website`, while post-layout pages including Profile use `article`
- And: page URLs use the RSS production origin `https://daiksud.me` and existing paths without a trailing slash except Home
- And: query strings, fragments, and local or Preview origins are excluded
- And: Japanese text, quotes, and ampersands survive parsing unchanged

### Scenario: OG-02 Retrieve the shared image

- Given: any shared page
- When: a consumer reads its image metadata
- Then: one absolute image URL under the same production origin identifies the common checked-in PNG
- And: descriptive alternative text explains the image
- And: the built and hosted image decodes successfully
- And: any declared dimensions match the asset

### Validation boundary

Fixture build tests parse static HTML for OG-01 and OG-02. Hosting checks retrieve the shared image through the existing static hosting setup. Existing reader journeys protect visible content, titles, routes, RSS discovery, and deployed `X-Robots-Tag: noindex`. Third-party preview rendering and cache invalidation are outside this contract, as is custom-domain activation.
