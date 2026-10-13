---
type: Feature
title: Article table of contents
description: Readers scan article headings and jump to a section using static links.
---

## Feature: Navigate an article by its headings

### Scenario: TOC-01 Scan the article structure

- Given: an article has at least two body h2 or h3 headings
- When: a reader opens the article
- Then: a compact navigation labelled Table of contents appears after the header and before the body
- And: its list follows document order and visually distinguishes h3 entries

### Scenario: TOC-02 Include only useful article outlines

- Given: any article using the shared post layout, including Profile
- When: its body has zero or one eligible heading
- Then: no table of contents or empty wrapper appears
- And: the article title and h4 through h6 headings never become entries

### Scenario: TOC-03 Preserve rendered heading identity

- Given: Japanese, repeated, emphasized, code, or escaped-text headings
- When: the table of contents is rendered
- Then: readable labels are escaped text and links target the corresponding rendered heading IDs
- And: the existing Markdown renderer remains the only source of heading IDs

### Scenario: TOC-04 Follow links on desktop and mobile

- Given: JavaScript is disabled and an article includes repeated headings and long labels
- When: a reader follows a link or activates it with the keyboard
- Then: navigation reaches the intended section and keyboard focus is visible
- And: the table of contents fits within the article without horizontal overflow

### Validation boundary

Dedicated fixture build tests and Playwright checks cover TOC-01 through TOC-04. Existing reader journeys protect metadata, tags, content, Home navigation, routes, and hosting noindex policy. Sticky navigation, active-section tracking, scripts, and per-post configuration are outside this feature.
