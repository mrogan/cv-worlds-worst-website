# AGENTS.md

Mossop's Practical Sundries: a small shop that is bad on purpose, looked after by [Software Factory](https://github.com/the-roganator/cv-software-factory). Read the [README](README.md) first.

Everything you write here is public and part of a portfolio. Write for a thoughtful reviewer.

## Working here

```sh
mise install && pnpm install   # the toolchain mise.lock holds, dependencies and git hooks
make check                     # what CI requires: lint, types, tests, rendered manifests
make dev                       # the shop on :8080, restarting on change
```

- Node 24 runs TypeScript directly: erasable syntax only, `.ts` extensions in imports, no build step. No framework.
- `src/` is the server, `src/pages/` the pages, `public/` what the browser fetches, `data/catalogue.json` what the shop sells. `scripts/seed.ts` builds the database from it; the server only ever reads.
- **Copy comes from [the brief](docs/BRIEF.md).** Anything a visitor reads is in Gerald's voice. If a line could not have come from him, it is wrong.
- A change comes with its test. Tests use their own catalogue (`test/support/`), so they do not depend on what the shop sells.
- Interpolate into pages only through `html` (`src/html.ts`), which escapes. What a visitor reports is never shown on any page.
- A change behind a feature flag asks `await request.flag('name')`, which is off unless flagd says it is on. A flag's name is lower-case letters and digits in words joined by hyphens (`big-buttons`); any other is always off. Only the flag context (`src/flags/`) imports OpenFeature; flagd, not the shop, decides who sees what. A route that asks about a flag replies `cache-control: private, no-store`, whatever the flag's state, so that no cache in between keeps one side of a flag or outlives it: the flag context sets it, it is not a change to the page with the flag off, and a test that pins a page's headers allows for it.
- Commits and pull request titles are Conventional Commits. Pull requests are squash-merged; nothing is pushed to `main`.
- `deploy/` is GitOps: Argo CD deploys what is on `main`. This repository may deploy only namespaced resources into the `website` namespace.
- Files listed in `.github/CODEOWNERS` are the rules. Change them only when Martin asks.
- pnpm installs no release younger than a day, runs no dependency's install script unless `pnpm-workspace.yaml` allows it, and refuses a provenance downgrade.
- The toolchain moves only when someone upgrades it: `mise upgrade`, which writes `mise.lock`, and both files in a `chore(toolchain)` pull request ([`CONTRIBUTING.md`](CONTRIBUTING.md#working-on-it) says how). Dependabot does not read mise.
