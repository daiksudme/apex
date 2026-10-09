---
type: Feature
title: Site navigation and the Home table of contents
description: Acceptance criteria for distinguishing page navigation, navigation within Home, and external links.
---

## Feature: Readers navigate to the intended page and Home section

Readers can distinguish navigation between site pages, the table of contents within Home, and external link destinations.

### Rule: Shared navigation identifies the four site pages

#### Scenario: NAV-01 Choose pages and external links

- Given: the reader is viewing any page on the site
- Then: Home, Posts, Tags, and Profile link to `/`, `/posts`, `/tags`, and `/profile`, respectively
- And: they appear in the sidebar on desktop and in the site menu above the body on mobile
- And: the header does not duplicate the same navigation
- And: shared GitHub, X, and Zenn links are available from the footer
- And: external links in the introduction and the link to the change history are preserved

### Rule: Home's short introduction is read in About, and the detailed introduction in Profile

#### Scenario: NAV-02 Navigate from the short introduction to the details

- Given: the reader is viewing Home
- Then: the short introduction is labeled About and retains the existing amount of introductory text
- And: About links to the detailed article at `/profile`
- And: the detailed Profile retains its existing body and shared post presentation

### Rule: On this page links to headings within Home

#### Scenario: NAV-03 Use the table of contents with a keyboard

- Given: Home's Welcome contains an ls command and an on-page table of contents presented as its output
- Then: About, Latest Posts, Tags, and Recent Commits reference `#about`, `#posts`, `#tags`, and `#commits`, respectively
- And: each destination is unique, brings the reader near the corresponding heading, and can receive focus
- And: the table of contents displays `#` to distinguish its links from the global navigation's selection state
- And: links can be operated with Tab and Enter, with visible focus and the existing skip-to-content link available

### Scenario: NAV-04 Read Home at desktop and mobile widths

- Given: Home has Welcome, About, Latest Posts, Tags, and Recent Commits panes
- When: the reader uses widths 1440, 1100, 961, 960, and 390 pixels
- Then: desktop pane pairs have matching row edges
- And: mobile panes retain their reading order without overlap or horizontal overflow
- And: pane content is not clipped

Browser verification traces NAV-01 through NAV-04 in [reader.browser.mjs](../../tests/acceptance/reader.browser.mjs). It uses local generated content and the deployed Preview; failures retain a screenshot and Chromium trace.
