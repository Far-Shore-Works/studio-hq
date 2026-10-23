# Studio HQ

The shared status page for the Far Shore Works founders: the gameplan, decisions, the name vote, products, the
team thread and a log of every change. Live at **https://hq.farshoreworks.com** (sign-in required).

- **Agents and access:** [AGENT-ACCESS.md](AGENT-ACCESS.md) explains how each founder's Claude connects, the tables, and the `actor` rule.
- **Docs and Founders:** the **Docs** tab shows markdown documents by folder (Plan, Money, Decisions, Game, Admin),
  searchable, each *shared* with both founders or *private* to its owner (enforced by row-level security, not
  the page). The **Founders** panel shows each founder's money in (from the ledger, with Chris's progress toward
  the $500 gift in the founder terms) and weekly hours (each founder logs and edits only their own). Docs are
  written by agents from files with `bin/studio-hq docs-sync`; see [AGENT-ACCESS.md](AGENT-ACCESS.md).
- **Stack:** React 18 + Tailwind on Vite, deployed to GitHub Pages by Actions. Data, sign-in and live updates
  come from Supabase (free tier). The publishable key in `src/lib/supabase.ts` is public by design; row-level
  security keeps the data private.

## Develop

```sh
npm ci
npm run dev          # http://localhost:5173 against the real project (sign in with your founder email)
npm run typecheck && npm test && npm run build
```

Screenshots without signing in: `vite --mode shots` swaps in `preview/fake-supabase.ts` (never in production
builds) and reads `preview/seed.local.json`, which `scripts/make-preview-seed.py` makes from an export. Add
`?out=1` for the sign-in screen, `?as=aaron` to view as Aaron. `node preview/cdpshot.mjs URL OUT.png W H light|dark mobile(0|1) full(0|1|2)`
takes a headless Chrome shot.

## Database

- `supabase/migrations/`: the schema, in order. Apply new files with the Supabase MCP (`apply_migration`) or the
  dashboard SQL editor, then commit them here.
- `tests/rls.sql`: the row-level security checks. Run it as postgres; it reports `RLS RESULT: n/n passed` in its
  error text and rolls everything back. `tests/rls-docs.sql` does the same for Docs and hours (paste it into the
  SQL editor to check the live project). `npm test` also runs both Docs/hours checks offline: `tests/db.test.ts`
  applies every migration to a local Postgres (PGlite) with a small Supabase stand-in
  (`tests/db/supabase-stub.sql`) and runs `rls-docs.sql` against it.
- `scripts/import-artifact-export.py`: the one-time import from the old claude.ai page.

## Deploy and upkeep

- Push to `main`: `.github/workflows/deploy.yml` typechecks, tests, builds and publishes to Pages.
- `.github/workflows/keepalive.yml` pings the database every 3 days so the free project doesn't pause. GitHub
  turns scheduled workflows off after 60 days without commits; if that happens, re-enable it under Actions.
