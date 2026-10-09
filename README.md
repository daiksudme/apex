---
type: Guide
title: apex site build
description: Overview of the Astro static site and how to check, test, and build it.
---

## apex

This is a static site built with Astro. Its output directory is `dist/`. Cloudflare deployment settings are managed in [wrangler.jsonc](wrangler.jsonc).

The live site is available at <https://apex.daiksud-a1f.workers.dev/>.

### Home design terminology

Inspired by [tmux panes](https://github.com/tmux/tmux/wiki/Getting-Started#sessions-windows-and-panes) and [herdr panes](https://herdr.dev/docs/concepts/#pane), we call the divided content regions on Home **panes**. Use this term consistently in screen descriptions, design, CSS, and tests.

| Name | Role | CSS class |
| --- | --- | --- |
| Sidebar pane | Navigation to the four site pages and Tags | `sidebar-pane` |
| Welcome pane | Terminal-style introduction, site overview, and an on-page table of contents presented as ls command output | `welcome-pane` |
| About pane | Avatar, name, location, short introduction, and a link to the detailed Profile | `about-pane` |
| Posts pane | Latest posts; shows an empty state when no posts have been published | `posts-pane` |
| Tags pane | Tags used in posts | `tags-pane` |
| Commits pane | Link to the GitHub change history | `commits-pane` |
| Footer pane | Closing prompt, GitHub / X / Zenn links, and copyright | `footer-pane` |

The shared outer container is `pane`, and the shared inner elements are `pane-heading` / `pane-label` / `pane-link` / `pane-footnote`. Home consists of seven panes, all using `src/components/Pane.astro`. The Sidebar pane and Footer pane use `aside` / `footer` and occupy the site shell's `sidebar` / `footer` Grid Areas. The remaining five use `section` and are direct Grid Items of `dashboard`. The five panes in main display a shared header; only each pane's specific content is passed through its slot. The site Header is a top bar, distinct from the panes.

The shared Navigation covers four pages: Home `/`, Posts `/posts`, Tags `/tags`, and Profile `/profile`. It appears in the Sidebar pane on desktop and in a site menu above the body on mobile. The header displays the brand and tagline. Welcome's on-page table of contents is presented as `ls` command output and links to About `#about`, Latest Posts `#posts`, Tags `#tags`, and Recent Commits `#commits`. The links display `#` to distinguish them from the current-page selection, and each destination can also receive keyboard focus. Shared GitHub / X / Zenn links appear in the Footer pane. See [site navigation and the Home table of contents](docs/features/navigation.feature.md) for detailed acceptance criteria.

These are design terms for the blog UI. They do not imply an actual terminal, session management, or pane splitting, movement, or resizing. Keep the site name `daiksud.me`, prompt `daiksud@kawasaki:~$`, and location `Kawasaki, Japan` unchanged.

### Post pages

Place posts in `src/content/posts/<slug>.md`. Astro's Content Collection statically generates them at `/<slug>`. `/posts` lists all posts in descending order of `publishedAt`.

All individual posts use the shared post layout, omit the Post pane heading, and begin with the terminal line `cat <slug>.md`. The profile is generated at `/profile` from `profile.md` and displays `cat profile.md`. The profile follows the same date, tag, and listing rules as other posts. The Profile menu points to `/profile`; Home's short introduction appears in the About pane with a link to the detailed Profile.

To protect the existing index routes `/posts` and `/tags`, post names `posts` and `tags` cause a build error. No pages or redirects are generated at the old `/posts/<slug>` paths. See [individual post routes and shared presentation](docs/features/posts.feature.md) for detailed acceptance criteria.

Frontmatter uses the following format:

```yaml
---
title: Post title
description: Post summary
publishedAt: 2026-10-01
updatedAt: 2026-10-02 # optional
tags:
  - astro
  - development
---
```

Use the Markdown filename directly as the `slug` rather than duplicating it in frontmatter. The layout renders the post title as `h1`, so do not use a `#` heading in the Markdown body. Start body headings at `##`.

### Tag definitions

Define available tags in the `catalog.tags` array in [src/content/tags.yaml](src/content/tags.yaml). Specify defined `slug` values in each post's frontmatter `tags`.

```yaml
catalog:
  tags:
    - slug: astro
      tone: blue
    - slug: development
      tone: pink
```

Both `slug` and `tone` are required. Defining the same `slug` more than once causes a build error. `tone` must be one of `blue` / `purple` / `green` / `pink` / `yellow` / `orange` / `cyan` / `muted`. Add a new tag to the definitions before using it in a post. If even one post uses an undefined tag, the build fails with an error identifying the post and tag.

Home, the tag index, and the sidebar display only tags in use. Tags are ordered by descending number of posts referencing them, with ties broken by ascending `slug`. YAML array order does not affect display order.

See [post tag definitions and references](docs/behavior/tags.feature.md) for detailed acceptance criteria and [blog terminology](docs/glossary.md) for definitions.

### Japanese typography

Japanese body text uses `word-break: auto-phrase`, preceded by `word-break: normal` as a fallback for unsupported browsers. Do not rely solely on automatic phrase detection; explicitly use `<wbr>` where an intended line-break opportunity exists.

Headings use `font-feature-settings: "palt"` to tighten character spacing and `text-wrap: balance`. Do not apply `balance` to body text. Normal body text uses the pane's available width directly; do not set a fixed `max-width` without a specific reason.

Reference: https://developer.chrome.com/blog/css-i18n-features

### Testing and building

Use Node.js `26.10.0` and pnpm `12.6.0`. Versions are pinned in [mise.toml](mise.toml) and [package.json](package.json). Keep [.node-version](.node-version), which Cloudflare Workers Builds reads, aligned with the same Node.js version.

```sh
mise trust mise.toml
mise install
mise exec -- pnpm install --frozen-lockfile
mise exec -- pnpm check
mise exec -- pnpm build
mise exec -- pnpm test:unit
```

Tests protect public contracts with inputs and observable results. Unit tests cover dates, titles, post ordering, and content-backed tags. Fixture integration builds valid content and checks build-time diagnostics for duplicate tags, undefined tags in older posts, and route collisions. Its browser check observes readable Markdown, metadata, post/tag ordering, and navigation from isolated fixture content. Tests do not freeze source text, YAML shape, raw HTML/CSS, classes, generated identifiers, or internal invocation sequences. Acceptance runners, browser assertions, and smoke checks have no self-tests.

### Browser acceptance

English reader scenarios live in [`docs/features`](docs/features). Author tag definitions and invalid-reference rules remain in [`docs/behavior/tags.feature.md`](docs/behavior/tags.feature.md). `pnpm test` runs the public unit and fixture integration suite. `test:unit` runs fast public-interface tests; `test:integration` runs [`tests/content.build.test.mjs`](tests/content.build.test.mjs), including its real fixture browser checks. Install Chromium before running `test`, `test:integration`, or acceptance. `test:ci` tests Preview selection and rejection from provider/deployment inputs and returned results.

Playwright is pinned in the lockfile. Install its matching Chromium shell before running acceptance:

```sh
mise exec -- pnpm test:ci
mise exec -- pnpm exec playwright install --only-shell chromium
mise exec -- pnpm test
mise exec -- pnpm test:acceptance
mise exec -- pnpm test:acceptance "$PREVIEW_URL"
```

On Linux, use Playwright's `install --with-deps --only-shell chromium` when browser system dependencies are absent. The acceptance command builds local `dist` before validation, then runs fixture integration tests and local reader journeys at 1440, 1100, 961, 960, and 390 pixels. Supplying the recorder-matched `PREVIEW_URL` adds the same journeys against the deployed Preview. PR CI must supply that URL; main-push acceptance uses the local build.

Acceptance runs once and fails directly on an execution error or failed expectation. Command logs are retained under `test-results/acceptance`; browser failures retain screenshots and traces in the corresponding local/Preview directory. Fixture content diagnostics use the `fixtures-populated` and `fixtures-empty` directories; site journeys use `local` and `preview`. The geometry helper is called by the reader journey; it has no separate server or browser command. Visible focus and selection compare the current rendered states without golden screenshots. See the [acceptance scenarios](docs/features/acceptance.feature.md).

The initial smoke check is separate: [`test:smoke`](scripts/ci/smoke.mjs) requests only `/` on the matched Preview and requires HTTP 200 with a bounded request timeout. It does not follow redirects or inspect content.

### Codex approval automation

[The approval workflow](.github/workflows/approve-codex-review.yml) copies the [approved agents source revision](https://github.com/daiksud/agents/blob/2e0067890bc39f94a8ff9580bd58ba093a3a9428/.github/workflows/approve-codex-review.yml) (blob `67e6e65c5a13e9cf87eaa2240a52dc583d88fd9f`), not its moving `main` branch. When `chatgpt-codex-connector[bot]` creates or edits a Codex Review Summary comment on a PR, it fetches that Summary again and requires both Code Review and Security Review to show `Completed`. It approves with `gh pr review --approve` only when the same Codex account also has a thumbs-up reaction on the PR body; other users' reactions do not count.

If both reviews are complete but the thumbs-up is missing, it retries every 30 seconds, at most six times after the initial check (180 seconds of waiting). Each retry rereads the Summary and stops without approval if either review is incomplete. Exhausting the polling window exits normally; an API or approval error fails the run. Another Summary creation or edit is needed to trigger another check after the polling window ends.

As in that source revision, the workflow does not compare reviewed commits with HEAD, filter reactions by timestamp, or withdraw existing approvals. An older completed Summary and existing thumbs-up can therefore approve newer code; freshness is deliberately not guaranteed. The workflow does not check out PR code, wait for CI, or merge PRs. Required CI, Preview, CodeQL, and review protections remain separate and unchanged.

### PR validation

The [PR workflow](.github/workflows/ci-pr.yml) follows five jobs: `draft` → `commit-stage` → `ready` → `acceptance-stage` → `pass`. Every run first attempts Draft, validates the source and its matched Preview, marks the PR Ready, and runs local and Preview acceptance. The final required `pass` job reports whether the preceding stages succeeded. It performs no additional validation or PR state changes. Opening, updating, reopening, and editing a PR trigger the workflow.

Draft and Ready use `gh pr ready --undo` and `gh pr ready` with write permissions scoped to those jobs. No HEAD freshness checks or fork/Dependabot-specific exceptions are applied. If a state change is denied, dependent jobs do not run and `pass` fails. A failed commit-stage leaves the PR Draft; failed acceptance leaves it Ready with a failed `pass` check. The workflow never returns a failed PR to Draft as recovery.

The [main-push workflow](.github/workflows/ci-push.yml) continues to run `commit-stage` → `acceptance-stage` → `ci` without PR operations. Both workflows reuse the [commit-stage](.github/actions/commit-stage/action.yml) and [acceptance-stage](.github/actions/acceptance-stage/action.yml) composites. On PRs, commit-stage retains read access to Checks and Deployments so it can find the matched Preview URL, which acceptance-stage consumes. See the [lifecycle scenarios](docs/features/pr-validation.feature.md).

Ready enables an explicit user or coding-agent AI review request once current source validation succeeds; GitHub may automatically request CODEOWNERS review as a side effect. The workflow itself does not request AI review. Ready is not permission to merge: required `pass`, Preview deployment, CodeQL, up-to-date checks, approvals, and resolved threads remain enforced independently.

To restart all state transitions after failed validation, use **Re-run all jobs** or push a new commit; rerunning only failed jobs is not a complete lifecycle restart. PR-scoped concurrency cancels superseded runs, but cancellation is not atomic with Draft/Ready mutations and cannot guarantee a terminal state. There is no custom run-history, retry, or state-assertion engine. Candidate jobs remain read-only, check out without retained credentials, and invoke the shared validation composites; mutation jobs execute only `gh` commands without checking out candidate code.

### Recording Cloudflare deployments

When Cloudflare Workers Builds' `Workers Builds: apex` Check succeeds, the [synchronization workflow](.github/workflows/record-cloudflare-deployment.yml) records a GitHub Deployment and a `success` Status for that Check's SHA. If the Check Suite's branch is `main`, it records `production`; for any other nonempty branch, it records `preview`. Cloudflare Workers Builds performs the actual deployment.

The recorder and PR Preview matcher share [one alias helper](scripts/ci/preview-url.mjs), following the [Workers SDK branch-alias rules](https://github.com/cloudflare/workers-sdk/blob/08d694cc8ed69ffe264405a342f1ae0f233d7792/packages/deploy-helpers/src/deploy/helpers/preview-alias.ts). It normalizes punctuation and case, and truncates long aliases with the provider's original-branch hash suffix. Branches without a valid leading-letter alias fail clearly. The recorder loads only this helper from the trusted default-branch workflow commit, without installing dependencies or checking out PR candidate code.

If synchronization fails, inspect the execution logs of the GitHub Actions workflow named “Record Cloudflare deployment” to determine whether the failure occurred while fetching the Check Suite, creating the Deployment, or creating its Status. The initial version records only successful Checks and does not automatically repair duplicates from reruns or incomplete Deployments left by partial failures.

The `default` Ruleset for `main` requires a successful Deployment to `preview` before merging. To roll back only this condition, remove `preview` from Required deployments in GitHub Settings → Rules → Rulesets → `default`, while keeping all other rules intact.
