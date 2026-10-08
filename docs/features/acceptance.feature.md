---
type: Feature
title: Reader acceptance execution
description: One complete local and optional Preview validation with retained diagnostics.
---

## Feature: Maintainers validate documented reader journeys

### Scenario: ACCEPT-01 Execute acceptance once

- Given: the application build is available
- When: acceptance-stage executes
- Then: fixture integration, browser harness checks, and local reader journeys run once
- And: PR acceptance also runs the reader journeys against the matched Preview URL
- And: command logs are retained separately from browser screenshots and traces
- And: the local server closes after execution

### Scenario: ACCEPT-02 Stop on failure

- Given: a required acceptance command fails
- When: acceptance-stage receives its result
- Then: the original failure stops the stage without automatic retries
- And: diagnostics are retained and the local server closes
- And: the PR workflow's final check returns the PR to Draft and remains unsuccessful

Verification corresponds to [acceptance.node.mjs](../../tests/ci/acceptance.node.mjs), [reader.node.mjs](../../tests/acceptance/reader.node.mjs), and the [acceptance composite](../../.github/actions/acceptance-stage/action.yml).
