---
type: Feature
title: Reader acceptance execution
description: One complete local and optional Preview validation with retained diagnostics.
---

## Feature: Maintainers validate documented reader journeys

### Scenario: ACCEPT-01 Execute acceptance once

- Given: the application build is available
- When: acceptance-stage executes
- Then: fixture content integration and local reader journeys validate the application
- And: populated and empty fixture collections verify readable posts and the no-post/no-tag state
- And: PR acceptance also runs the reader journeys against the matched Preview URL
- And: command logs are retained separately from browser screenshots and traces

### Scenario: ACCEPT-02 Stop on failure

- Given: a required acceptance command fails
- When: acceptance-stage receives its result
- Then: the original failure stops the stage without automatic retries
- And: diagnostics are retained and the local server closes
- And: the PR workflow's final check returns the PR to Draft and remains unsuccessful

Application checks run through [the acceptance command](../../scripts/ci/acceptance.mjs), [fixture content integration](../../tests/content.build.test.mjs), [reader journeys](../../tests/acceptance/reader.browser.mjs), and the [acceptance composite](../../.github/actions/acceptance-stage/action.yml). The runner and browser assertions are not tested through deliberately broken pages or invocation self-tests.
