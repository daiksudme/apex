---
type: Feature
title: RSS subscription and discovery
description: Readers discover a summary feed and open the original posts using stable production URLs.
---

## Feature: Subscribe to posts

Readers can discover the RSS feed from any shared site page and open the original article from their feed reader.

### Rule: The feed follows the post listing

#### Scenario: RSS-01 Read the published post feed

- Given: posts include the Profile entry and have different publication dates
- When: the static site is built
- Then: `/rss.xml` contains the site's title, description, and production link
- And: each listed post appears once, newest publication date first
- And: each item contains its title, summary, original publication date, and absolute article link
- And: article links and GUIDs use `https://daiksud.me/<slug>` without a trailing slash
- And: the feed contains summaries rather than full article HTML

#### Scenario: RSS-02 Keep identity when a summary changes

- Given: a published post has an existing feed item
- When: its description and update date change and the site is rebuilt
- Then: its summary changes while its GUID and original publication date stay unchanged

#### Scenario: RSS-03 Preserve text in XML

- Given: a post title and summary contain Japanese text and XML-sensitive characters
- When: a reader parses the feed as XML
- Then: the original title and summary text are preserved

#### Scenario: RSS-04 Read an empty feed

- Given: the post collection is empty
- When: the site is built
- Then: `/rss.xml` is valid RSS with the site metadata and no items

### Rule: Readers can discover and open the feed

#### Scenario: RSS-05 Discover the production feed

- Given: a reader visits Home, Posts, Tags, Profile, or an article
- When: their reader inspects the page's HTML head
- Then: one RSS alternate link identifies `https://daiksud.me/rss.xml`
- And: local and Preview hosts do not replace the production origin in discovery, channel links, article links, or GUIDs

#### Scenario: RSS-06 Open the feed from the footer

- Given: a reader uses a desktop or mobile viewport
- When: they reach the shared footer with the keyboard
- Then: a visible RSS link can receive focus and open `/rss.xml`
- And: the response succeeds with an RSS/XML content type
- And: the existing navigation and footer links remain available

### Validation boundary

Fixture integration checks RSS-01 through RSS-04 using isolated content and parsed XML. Shared reader journeys check RSS-05 and RSS-06 on local and matched Preview builds. Deployed response checks also verify `X-Robots-Tag: noindex`; the local test server does not emulate Cloudflare headers. Production verification uses `https://daiksud.me/rss.xml`. Configuring the production origin does not configure DNS or the Cloudflare custom domain.
