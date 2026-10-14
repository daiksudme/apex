---
type: Feature
title: Site-branded not-found page
description: Readers can recover from a missing page while the server returns HTTP 404.
---

## Feature: Site-branded not-found page

The static `404.html` uses the shared site layout and the existing Cloudflare
`404-page` handling. It is not an article and is not added to posts, tags, RSS
items, or the main navigation.

```gherkin
Scenario: NOTFOUND-01 Open a missing page
  Given I request a nonexistent top-level or deeply nested page
  Then the response status is HTTP 404
  And the requested URL is not redirected
  And the page explains that the page could not be found
  And the existing shared navigation and hosted noindex policy remain intact

Scenario: NOTFOUND-02 Recover without JavaScript
  Given JavaScript is disabled
  And I open a deeply nested missing URL at mobile or desktop width
  Then the shared styles load and the page fits the viewport
  And Home and All posts are available with visible keyboard focus
  When I activate either recovery link
  Then its existing destination opens on the same host in the same tab

Scenario: NOTFOUND-03 Reject a conflicting article slug
  Given an article is named 404.md
  When I build the site
  Then the build fails with an actionable route-conflict error
```

Coverage: `tests/acceptance/not-found.browser.mjs` runs through the existing reader
acceptance entry point against local fixture builds and the matched deployed
Preview. The route-collision fixture in `tests/content.build.test.mjs` covers the
reserved slug. Existing post, tag, and feed checks protect their collection rules.

The local acceptance server serves the generated error document with HTTP 404;
this does not by itself establish Cloudflare behavior. Preview checks request
actually missing URLs and verify the response status, body, headers, and links.
DNS/custom-domain activation and release operations are outside this feature.
