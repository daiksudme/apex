---
type: Feature
title: Bounded acceptance retries
description: One retry budget for plausibly transient errors in the acceptance stage.
---

## Feature: Maintainers retry temporary acceptance execution failures

### Scenario: RETRY-01 Recover within one stage retry budget

- Given: the acceptance stage has a classified temporary transport or upstream error
- When: acceptance retries the complete stage validation
- Then: it makes at most three retries after the initial attempt
- And: the PR remains Ready while retrying
- And: each attempt retains its result, classification, and diagnostics

### Scenario: RETRY-02 Stop deterministic failures immediately

- Given: acceptance has an assertion, configuration, authentication, or generic timeout failure
- When: the stage fails
- Then: it does not blindly retry that failure

### Scenario: RETRY-03 Stop after terminal failure

- Given: the retry budget is exhausted or a non-transient failure occurs
- When: acceptance finishes unsuccessfully
- Then: required CI remains unsuccessful
- And: terminal reconciliation returns only the current PR validation cycle to Draft
- And: a new pushed source commit is required to start another validation cycle

Retries do not redeploy, request reviews, or create nested retry budgets. Stage budget verification corresponds to [acceptance.node.mjs](../../tests/ci/acceptance.node.mjs); state reconciliation is verified separately with the native workflow.
