---
type: Feature
title: PR validation lifecycle
description: Current-revision Draft, Ready, terminal failure, and required CI behavior.
---

## Feature: Maintainers validate the current PR revision before merging

### Scenario: STATE-01 Start source validation in Draft

- Given: an eligible same-repository team PR is open
- When: a new source commit starts validation
- Then: the PR is Draft before commit-stage runs
- And: obsolete heads, runs, and attempts cannot change its state

### Scenario: STATE-02 Promote successful commit validation

- Given: the current commit-stage passes and identifies the intended Preview
- When: the Ready state job completes
- Then: acceptance-stage starts through native job dependencies
- And: the user or coding agent may explicitly request external review in parallel

### Scenario: STATE-03 Stop after terminal acceptance failure

- Given: current acceptance-stage fails finally
- When: terminal reconciliation runs
- Then: the PR returns to Draft and required CI fails
- And: this state change does not start another validation cycle

### Scenario: GATE-01 Fail closed on incomplete or obsolete work

- Given: required validation or state work fails, is canceled, is absent, or is unexpectedly skipped
- When: the native required `ci` job evaluates the results
- Then: it cannot report success for that PR revision

### Scenario: GATE-02 Preserve main validation

- Given: a commit is pushed to main
- When: CI runs
- Then: build, fast checks, fixture integration, and local browser acceptance run
- And: PR state jobs are explicitly inapplicable
- And: Cloudflare retains ownership of production deployment

### Scenario: TIMING-01 Report a slow successful commit path

- Given: the complete trigger-to-commit-stage path exceeds five minutes
- When: functional commit validation passes
- Then: Actions warning and summary report queue/control, runner execution, and observed Preview waiting separately
- And: an English PR notification is deduplicated for source revision, run, and attempt
- And: the PR still proceeds to Ready and acceptance

Timing uses native workflow creation through commit completion, including Draft reset and waiting. A rerun explicitly labels this baseline as since workflow creation, including earlier attempts; it does not claim a separately observable rerun-trigger duration. Missing timestamps or notification API errors produce warnings without fabricating timing or blocking functional promotion.

Fork and Dependabot PRs are outside the automatic state-mutation model. The final required gate does not silently treat them as a completed supported PR lifecycle. GitHub mutations lack an atomic expected-source-SHA condition; pre/post checks and cancellation reduce and detect races, while current-revision required checks and existing protections remain the merge boundary.

Verification corresponds to [workflow.node.mjs](../../tests/ci/workflow.node.mjs) and the single native [CI workflow](../../.github/workflows/ci.yml).
