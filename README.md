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

The shared Navigation covers four pages: Home `/`, Posts `/posts`, Tags `/tags`, and Profile `/profile`. It appears in the Sidebar pane on desktop and in a site menu above the body on mobile. The header displays the brand and tagline. Welcome's on-page table of contents is presented as `ls` command output and links to About `#about`, Latest Posts `#posts`, Tags `#tags`, and Recent Commits `#commits`. The links display `#` to distinguish them from the current-page selection, and each destination can also receive keyboard focus. Shared GitHub / X / Zenn links appear in the Footer pane. See [site navigation and the Home table of contents](docs/behavior/navigation.feature.md) for detailed acceptance criteria.

These are design terms for the blog UI. They do not imply an actual terminal, session management, or pane splitting, movement, or resizing. Keep the site name `daiksud.me`, prompt `daiksud@kawasaki:~$`, and location `Kawasaki, Japan` unchanged.

### Post pages

Place posts in `src/content/posts/<slug>.md`. Astro's Content Collection statically generates them at `/<slug>`. `/posts` lists all posts in descending order of `publishedAt`.

All individual posts use the shared post layout, omit the Post pane heading, and begin with the terminal line `cat <slug>.md`. The profile is generated at `/profile` from `profile.md` and displays `cat profile.md`. The profile follows the same date, tag, and listing rules as other posts. The Profile menu points to `/profile`; Home's short introduction appears in the About pane with a link to the detailed Profile.

To protect the existing index routes `/posts` and `/tags`, post names `posts` and `tags` cause a build error. No pages or redirects are generated at the old `/posts/<slug>` paths. See [individual post routes and shared presentation](docs/behavior/posts.feature.md) for detailed acceptance criteria.

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
mise exec -- pnpm test
```

Post and tag tests use dedicated data in `tests/fixtures/`. Generated HTML tests copy the application source and fixtures into a temporary project and build it, without reading published posts or production tag definitions. In addition to successful builds, tests verify that an undefined tag in a post older than the latest three still causes failure.

### Recording Cloudflare deployments

When Cloudflare Workers Builds' `Workers Builds: apex` Check succeeds, the [synchronization workflow](.github/workflows/record-cloudflare-deployment.yml) records a GitHub Deployment and a `success` Status for that Check's SHA. If the Check Suite's branch is `main`, it records `production`; for any other nonempty branch, it records `preview`. Cloudflare Workers Builds performs the actual deployment.

If synchronization fails, inspect the execution logs of the GitHub Actions workflow named “Record Cloudflare deployment” to determine whether the failure occurred while fetching the Check Suite, creating the Deployment, or creating its Status. The initial version records only successful Checks and does not automatically repair duplicates from reruns or incomplete Deployments left by partial failures.

The `default` Ruleset for `main` requires a successful Deployment to `preview` before merging. To roll back only this condition, remove `preview` from Required deployments in GitHub Settings → Rules → Rulesets → `default`, while keeping all other rules intact.
