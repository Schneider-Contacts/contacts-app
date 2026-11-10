# Signup and compact Home integration, 10 November 2026

Ready for authorized frontend publication. No push or deployment was performed.

## Integrated tree

- Baseline: `f541c5b0e6b561cbd1bf27cd9545cafd91ba70e4`, fetched and checked against remote `main` before integration.
- Signup source: `a3bf09999006d139eaa8a8cc5a9dcdfd4b669bf6`.
- Compact Home source: `32c07306f2a61a5979bec590a639c36bfb44197d`.
- Branch: `release/signup-home-20261110`.
- Both changes applied without conflicts in a separate worktree. Existing source worktrees were not modified.
- Final stylesheet and app cache keys are both `20261110-signup-home-v1`.

The source review notes describe each feature. This note supersedes their statements that the other change is not included. The final runtime change is confined to `app.js`, `index.html`, and `styles.css`.

## Verification against the combined tree

- All 22 executable `tests/*.js` scripts passed, including 54 verification-session checks, search/selection, signup presentation, and existing registration/approval/security fixtures.
- All 26 simulated DOM dialog checks passed.
- Isolated headless Chrome signup QA passed all 150 checks on two consecutive final runs at 320, 375, 390, 430 and 960px. Coverage includes both signup paths, required fields, authenticated token-bound finalization, unverified/offline retry, missing-session recovery, preserved email, cleared old passwords, re-login, verification, reset copy and Back.
- Combined browser fixtures: 56 checks passed. Compact Home fixtures: 101 checks passed. Browser dialog fixtures: 26 checks passed. These include repeated Home activation, search/category clearing, no results, selection retention/resume, neutral heading focus, minimum touch size, no overlap and unchanged search width.
- Admin import browser checks passed at all five widths, covering synthetic file import, restoration/cancel, keyboard/touch review, failed publication remaining open, and successful publication closing. Pharmacology browser smoke passed all five widths.
- Syntax and whitespace checks passed. All Apps Script files and manifest, Firestore rules, logo assets, and protected owner-signature regions match the baseline byte-for-byte.
- Independent read-only review found no actionable runtime integration regressions.
- Combined-tree screenshots of Home at 320/960px and signup phone/details/session-recovery at 390px were visually inspected.

## Test harness correction

The first browser runs exposed a timing issue in the synthetic signup test: the screen's existing 0ms autofocus callback occasionally redirected accelerated confirmation-field typing to the password field. Failure diagnostics showed a 24-character first field and empty confirmation; the app correctly rejected the mismatch. The test now waits for scheduled focus before typing. No production code was changed to make the test pass. A reusable, externally isolated runner for the existing browser regression pages was also added at `qa/browser-regressions.js`.

## Limits and publication handoff

Browser service calls were stubbed with synthetic records and all external requests blocked. This is not a live Firebase/email integration test. No real account, email, contact, roster, permission, or backend changes occurred. Native Safari was tested for the original Home change, but was not rerun for this integration; no physical-iPhone check was performed.

Before an authorized push, refresh remote `main` again. If it changed, rebase/reintegrate and rerun the affected checks. Publish the three runtime files together through the repository's normal workflow, verify the exact remote commit and deployment, then check the served cache keys. Do not overwrite newer remote changes.

Rollback, if authorized and still appropriate: restore the pre-release frontend from `f541c5b` through a normal reviewed commit after checking intervening changes. No data rollback is required by this frontend-only integration.

## Reproduce locally

- Run `node --check` on application and QA JavaScript.
- Run every `tests/*.js` except `tests/dialog-test-cases.js`, which is a shared fixture module.
- Run `tests/dialog-accessibility.cjs` with an existing `jsdom` installation on `NODE_PATH`.
- Set `PLAYWRIGHT_MODULE` to the existing Playwright module, and optionally set `CHROME_EXECUTABLE` and `QA_SCREENSHOT_DIR`.
- Run `node qa/signup-browser.js`, `node qa/admin-import-browser.js`, `node qa/pharmacology-browser.js`, and `node qa/browser-regressions.js`.

The QA runners block all non-fixture requests. Do not substitute a production-write test for these synthetic checks.
