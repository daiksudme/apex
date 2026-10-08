---
type: Feature
title: Preview HTTP availability
description: A minimal root HTTP check after matching the intended Preview deployment.
---

## Feature: Maintainers confirm the matched Preview responds

### Scenario: SMOKE-01 Require HTTP 200 from the Preview root

- Given: the recorded Preview belongs to the current PR source head and branch
- When: commit-stage requests `/` with a bounded request timeout
- Then: the response status is exactly 200
- And: a different status or request error fails smoke validation

The requester reduced the initial smoke scope to this single HTTP check. Smoke does not inspect response content or request other routes. Preview source, branch, provider, and deployment identity validation remains required. Detailed reader journeys belong to separate browser acceptance scenarios.

Verification corresponds to [smoke.node.mjs](../../tests/ci/smoke.node.mjs) and [smoke.mjs](../../scripts/ci/smoke.mjs).
