---
type: Feature
title: End-of-article navigation
description: Readers can open the post index after finishing any article.
---

## Feature: End-of-article navigation

Readers who finish an article can continue to the post index without scrolling
back to the shared site menu. The same behavior applies to Profile.

```gherkin
Scenario: POST-05 Return to the post index after reading an article
  Given I open an article directly
  When I reach the end of its body
  Then an Article navigation region contains one All posts link
  And the link follows all article content
  And its destination is /posts on the current host
  When I activate the link
  Then the post index opens in the same tab

Scenario: POST-05 Use the link without JavaScript or browsing history
  Given JavaScript is disabled
  And I open a short article, a longer article with an outline, or Profile directly
  When I focus the All posts link with the keyboard
  Then its focus is visible at mobile and desktop widths
  And the article fits within the viewport
  When I press Enter
  Then I reach the post index in the same tab
```

The link belongs to the shared article layout, not individual Markdown files.
It preserves the existing article outline, metadata, tags, site menu, and footer.
It does not select previous, next, or related articles.

Coverage: `tests/acceptance/content.browser.mjs` observes the dedicated link during
existing article journeys and exercises direct visits with JavaScript disabled
against the existing isolated content fixtures. Existing local and Preview reader
journeys also verify that rendered articles contain the link.
