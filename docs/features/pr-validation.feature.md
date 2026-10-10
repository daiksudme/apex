---
type: Feature
title: PR validation lifecycle
description: Native job sequencing, Draft and Ready commands, and final pass checks.
---

## Feature: Maintainers validate team PRs before merging

### Scenario: STATE-01 Start each PR validation in Draft

- Given: a PR is opened, synchronized, reopened, or edited
- When: the PR workflow runs
- Then: it attempts to convert the PR to Draft before commit-stage
- And: PR-scoped native concurrency cancels superseded validation
- And: it does not compare HEAD or apply author/fork-specific skip conditions

### Scenario: STATE-02 Promote successful source validation

- Given: commit-stage passes and selects the matched Cloudflare Preview
- When: the Ready job completes
- Then: acceptance-stage starts through native job dependencies
- And: it receives commit-stage's matched Preview URL
- And: the user or coding agent may request external review in parallel
- And: GitHub may request CODEOWNERS review as an inherent Ready side effect
- And: the workflow does not explicitly request AI review through an API

### Scenario: STATE-03 Reject validation failures without state recovery

- Given: any mandatory upstream stage fails, is canceled, or is skipped
- When: the final `pass` job evaluates its required predecessor's result
- Then: `pass` cannot report success for that revision
- And: no failure-handling step changes the PR back to Draft
- And: acceptance failure after Ready leaves the PR Ready with a failed check

### Scenario: STATE-04 Restart the complete lifecycle

- Given: validation failed at any stage
- When: the maintainer reruns all jobs or pushes another commit
- Then: Draft, commit-stage, Ready, acceptance-stage, and `pass` run in order
- And: a failed-jobs-only rerun is not a complete state-transition restart

### Scenario: GATE-01 Preserve native success requirements

- Given: Draft, commit-stage, Ready, or acceptance-stage did not succeed
- When: the required `pass` check concludes
- Then: GitHub cannot treat that PR revision as passing validation

### Scenario: GATE-02 Preserve main-push validation

- Given: a commit is pushed to main
- When: the independent push workflow runs
- Then: build, fast checks, fixture integration, and local browser acceptance run
- And: its terminal check is named `pass`
- And: it performs no PR state operations or Cloudflare deployment

### Scenario: GATE-03 Reject failed state changes without exceptions

- Given: the PR workflow cannot perform a required Draft or Ready transition
- When: that state-mutation job fails
- Then: later dependent stages do not report success
- And: the final required `pass` check fails
- And: no special fallback lets a fork or Dependabot PR bypass state changes

Candidate validation jobs are read-only, check out without persisted credentials, and invoke the shared commit-stage and acceptance-stage composites. The PR commit-stage also reads Checks and Deployments to identify and validate the matched Preview. Mutation jobs execute only quoted `gh` commands without checking out candidate code. Cancellation is not an atomic state-mutation guarantee; a cancelled workflow may not finish its final check or restore Draft. Protected PR checks, Preview deployment, CodeQL, review approval, and branch freshness remain required for merging.

Verify these outcomes using actual [PR](../../.github/workflows/ci-pr.yml) and [main-push](../../.github/workflows/ci-push.yml) runs. Workflow-source and extracted-shell assertions are not a substitute for real GitHub execution. Preview-selection behavior is covered by [preview.node.mjs](../../tests/ci/preview.node.mjs).
