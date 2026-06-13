# CLAUDE.md

## Tooling

- This project uses **npm**, not bun. Use `npm install` / `npm run <script>`.
  The lockfile is `package-lock.json`. Do not run `bun install` here — it
  generates a `bun.lock` that does not belong in this repo (`bun.lock` is
  gitignored).

## Git

- Commit directly to `main` unless explicitly told otherwise. Do not create
  a new branch before committing just because `main` is the default branch.
