# Handoff — read this first, then go straight to the task

Written 2026-09-02 to hand this project to a fresh session (Opus) without it needing to
re-derive context. Keep this short-lived: update or delete it once it's stale, don't let it
become a second source of truth alongside `todo-jp0taelo.md`.

## Do this before touching code

1. Read `CLAUDE.md` (project root) — hard operational rules (no fake production data, mandatory
   denomination breakdowns, manual-only kurs activation, no auto-submit to regulators, etc.) and
   the required quality gate (`pnpm test && pnpm check && pnpm build`).
2. For anything touching workflow, data, kas, kurs, or reporting: read
   `docs/BUKU-PANDUAN-PENGGUNAAN-A-Z.md` (user-facing behavior) and
   `docs/SKEMA-DATABASE-PROJECT.md` (schema + control-table rationale) — don't guess either.
3. Skim the top ~15 entries of `todo-jp0taelo.md` for what shipped most recently and why. It's a
   detailed changelog with the actual regulatory research baked in (goAML XSD quirks, SIPESAT
   Pasal citations, etc.) — cheaper to read than re-deriving.

## Current state (as of commit `1be46a0`, deployed and live)

- goAML LTKT + LTKM XML export, SIPESAT CSV export, DTTOT/PPPSM watchlist screening (import +
  fuzzy match), SIPENDAR bulk name-matching, maker-checker review, expense log, transaction
  recap — all shipped and deployed.
- Just fixed (this session): the printed kwitansi's logo-loading race condition (print dialog was
  firing before the logo image finished loading over the network) and a layout/spacing pass on the
  same receipt; a card-based redesign of the "loaded watchlist" summary on
  `/operasional/watchlist`; and an explainer + step-numbered redesign of the SIPESAT/goAML export
  cards in `RegulatoryReportingAdvanced.tsx`. None of this was visually verified in a browser (no
  browser access in that session) — verify visually before assuming it's actually fixed.
- Deploy: production runs via `pm2` (process name `ibv-backoffice`) at
  `/var/www/ibukotavalasindo` on a self-hosted server, deployed by running `./deploy.sh` **on that
  server** (it backs up the DB, pulls `main`, migrates, builds, restarts pm2, smoke-checks). Ask
  the user for SSH access each time you need to deploy — don't assume you have it, and don't ask
  the user to paste credentials into a file.

## What the user wants next (stated directly, 2026-09-02)

1. **Laporan Keuangan (financial reporting)** — this is the flagged priority. Current state: a
   manual snapshot workflow in `RegulatoryReportingAdvanced.tsx` (`financialSnapshots`) where a
   Controller pastes/imports XLSX for FORM B0002/B0003/B0004, or a "workbook bundle" import, then
   builds a draft package that a Shareholder approves. The user hasn't yet said *what's* wrong with
   it — ask before redesigning. Likely candidates worth asking about: is the manual paste/import
   UX itself the problem, or is it that this whole feature is buried at the bottom of an
   already-huge page (see below)?
2. **Menu/submenu** — user says navigation feels messy. Relevant files: `shared/backOfficeNavigation.ts`
   (the destination list + role gating) and `client/src/components/DashboardLayout.tsx` (the
   sidebar/shell that renders it). No specifics given yet — ask what's actually bothering them
   (too many items? bad grouping? unclear labels?) rather than guessing a redesign.
3. **General UI/UX cleanup** — same story, no specifics yet. One concrete lead already identified
   in this session: `RegulatoryReporting.tsx` mounts `RegulatoryReportingAdvanced.tsx` at the
   bottom, so LKU package workflow + financial snapshots + SIPESAT + 2 goAML export cards +
   incident register all live on one very long page. Splitting this into tabs or separate routes
   is a reasonable, scoped first move if the user confirms that's part of what feels "messy" — but
   confirm before doing a structural split, since `backOfficeNavigation.test.ts` and
   `archiveControls.test.ts` assert on exact route/page-name strings in `App.tsx`.

## Things to *not* rediscover from scratch (save tokens — just reuse)

- Receipt printing lives in `client/src/pages/Transactions.tsx` (`printBon`) — shared by
  `TransactionCreate.tsx` and `TransactionList.tsx`. Other print functions (`DailyChecklist.tsx`,
  `SafeSimulation.tsx`, `RegulatoryReporting.tsx`'s `printPackage`, `RegulatoryReportingAdvanced.tsx`'s
  `printIncident`) don't embed a logo image, so they weren't affected by the race-condition bug
  just fixed — no need to re-check them for that specific issue.
- DTTOT/PPPSM/SIPENDAR fuzzy name matching lives in `shared/sanctionsNameMatch.ts` — reuse it if
  any other "match this name against X" need comes up rather than writing a second matcher.
- The financial snapshot import (`server/financialImport.ts`) already has the XLSX
  signature/size/MIME validation pattern used everywhere else file uploads happen in this app —
  copy that pattern for any new upload feature rather than inventing another one.

## Working style this user has reinforced repeatedly this session

- Build slowly and precisely; verify regulatory claims against the actual PDF/XSD the user
  provides rather than assuming from prior knowledge — this project is a real KUPVA BB business's
  compliance software (PT Ibukota Valasindo), and the DTTOT/PPPSM/SIPENDAR/goAML work all uses
  real PPATK regulation text/schema, not judgment calls.
- Never guess a data schema — if the user hasn't supplied a real sample file/schema, say so and
  ask, rather than inventing a plausible-looking one (this is why SIPENDAR ended up as a paste-box
  instead of a structured importer).
- Confirm scope on multi-step feature work via a couple of targeted questions before writing code,
  especially when there's a real design fork (e.g. "exact match vs fuzzy match", "one importer vs
  three"). Don't over-ask on small, obvious calls.
- Never push or deploy without an explicit go-ahead in that turn.
