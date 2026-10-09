---
type: Feature
title: PR validation lifecycle
description: Native job sequencing, Draft and Ready commands, and required CI behavior.
---

## Feature: Maintainers validate team PRs before merging

### Scenario: STATE-01 Start source validation in Draft

- Given: an eligible same-repository team PR is open
- When: a new source commit starts validation
- Then: the PR is Draft before commit-stage runs
- And: PR-scoped native concurrency cancels superseded validation

### Scenario: STATE-02 Promote successful commit validation

- Given: commit-stage passes and identifies the intended Preview
- When: the Ready state job completes
- Then: acceptance-stage starts through native job dependencies
- And: the user or coding agent may explicitly request external review in parallel
- And: GitHub may automatically request CODEOWNERS review as an inherent Ready side effect
- And: the workflow does not explicitly request AI review through an API

### Scenario: STATE-03 Return failed validation to Draft

- Given: a required upstream job fails or is skipped or canceled
- When: the final `ci` job evaluates native dependency results
- Then: it returns the PR to Draft and exits unsuccessfully
- And: successful demotion cannot turn the validation result green
- And: this state change does not start another validation cycle

### Scenario: STATE-04 Restart the complete lifecycle after failure

- Given: failed acceptance returned the PR to Draft
- When: the maintainer reruns all jobs or pushes a new commit
- Then: Draft, commit-stage, Ready, acceptance-stage, and final `ci` run in order
- And: a failed-jobs-only rerun is outside the supported state recovery path

### Scenario: GATE-01 Require successful upstream results

- Given: required validation or state work lacks a successful native result
- When: the native required `ci` job evaluates the results
- Then: it cannot report success for that PR revision

### Scenario: GATE-02 Preserve main validation

- Given: a commit is pushed to main
- When: CI runs
- Then: build, fast checks, fixture integration, and local browser acceptance run
- And: the push workflow performs no PR operations
- And: Cloudflare retains ownership of production deployment

### Scenario: GATE-03 Reject unsupported PRs without mutation

- Given: a fork or Dependabot PR is outside the automatic lifecycle
- When: the final required `ci` job runs
- Then: it fails rather than reporting skipped success
- And: it executes no candidate code or PR mutation

The two workflows share focused commit-stage and acceptance-stage composites only in read-only validation jobs. PR mutation jobs execute quoted `gh` commands without candidate checkout or local actions. Fork and Dependabot PRs are outside the automatic lifecycle. Native concurrency supplies cancellation; there are no custom run-history, timing, or state assertion checks. Cancellation is not an atomic state-mutation guarantee, and whole-run cancellation may prevent the final check from executing. Existing protected CI, deployment, review, and freshness conditions remain required for merge.

Validate these outcomes in actual [PR](../../.github/workflows/ci-pr.yml) and [main-push](../../.github/workflows/ci-push.yml) runs. Workflow-source and extracted-shell assertions are not a test boundary. Preview selection contracts are covered by [preview.node.mjs](../../tests/ci/preview.node.mjs).
