# CLAUDE.md

This repo is a personal fork of bitwarden/clients, maintained for the Microsoft Edge browser
extension only. Read [FORK.md](FORK.md) first: it lists every change from upstream, the build and
load steps, the tests to run, and the known gaps.

- Fork changes are marked `Fork patch` in the code. Keep new changes marked the same way.
- Build with `npm install --ignore-scripts` (not `npm ci`), then `npm run build:edge` in `apps/browser`.
  Do not commit `package-lock.json` changes.
- Run the tests listed in FORK.md before pushing, and update specs that assert upstream behaviour.
- Reply format for Harry: at most 10 bullets and 200 words, with anything he has to do as a numbered
  list at the bottom (leave it out if there is nothing). Instructions are numbered; findings and
  options stay as bullets or prose.
