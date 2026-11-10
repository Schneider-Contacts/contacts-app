# Contacts UX correction package

Prepared 2026-11-10 on branch `fix/ux-corrections-20261109` from deployed baseline `1b99b24`.

## Included

- Mixed name/phone searches require every query term, while formatted phone-only searches remain supported.
- Contact selection uses stable document IDs and survives searches, filters and empty results. Hidden selections are counted; removed records are pruned.
- Clearing a department/filter preserves the query. The department picker can reopen without clearing its selection. Empty results offer full-directory search or a new-contact suggestion.
- Admin usage metrics resolve a unique contact identity by stable ID or exact normalized email, never a phone-only join. Returning from a person restores the source metric; dismissed asynchronous loading does not reopen it.
- Admin request summaries distinguish additions, updates and join requests. Removed-directory status is distinct from login permission.
- Dialog keyboard focus starts at a neutral heading, traps Tab, restores the opener, hides background content and closes the topmost dialog with Escape. Confirmations stack above their parent editor.
- Browser Back closes the current dialog instead of leaving the page; Forward does not recreate stale forms. Draft edits in profile/add/report/admin-contact forms require discard confirmation and guard page exit. Saved submissions and stale asynchronous completions are handled separately.
- Signup describes the details/password/email-verification sequence, password length and explicit return to email. It does not claim that returning deletes an already-saved request. Mail instructions also address non-Gmail users.
- A missing/ambiguous profile offers directory search and manager contact. A linked profile has an explicit manager route for phone/email changes. WhatsApp links open a conversation but do not send a message automatically.
- The roster shows its actual source month and warns for past/future lists. No roster data is changed.
- Secondary text contrast and mobile search text size improved. Hidden contact fields remain hidden despite layout rules.

The earlier join/request/export corrections are inherited from the baseline, not reapplied. Pharmacology remains in its separate worktree. The live registration test and its pending request are not changed by this package.

## Verification

Final results are in `validation.log`. All 16 Node regression suites pass, plus 21 simulated DOM checks for keyboard/dialog/draft/history behavior. JavaScript syntax and `git diff --check` pass. The protected owner-signature block and logo assets are unchanged. No backend Apps Script or Firestore rule files were changed.

Run baseline and focused tests:

```sh
for f in tests/*.js; do
  [ "$f" = tests/dialog-test-cases.js ] && continue
  node "$f" || exit 1
done
node --check app.js
node --check dialog-accessibility.js
git diff --check
```

The DOM test runner needs `jsdom` in its Node module search path:

```sh
NODE_PATH=/path/to/test-dependencies/node_modules node tests/dialog-accessibility.cjs
```

`tests/dialog-accessibility.html` runs the same 21 cases in a real browser against a stripped local copy of the page and stubbed closers, without app login/network services. Serve the repository locally and open that test page. This browser run has **not** been completed: the browser automation connection was unavailable and native Chrome access timed out. jsdom has no real layout engine; visibility and inert behavior are simulated.

## Remaining release gate

Before any production publication, verify keyboard, mobile Back/Forward, unsaved drafts and nested dialogs in actual desktop/mobile browsers, including the logged-in application. Complete the deferred registration/verification test separately when feasible. No production login, service writes, deployment or pending-request cleanup was performed during this package work.

This is a local review package, not a deployment. Publish only after explicit approval and final release checks. The package changes frontend files only; publish `app.js`, `index.html`, `styles.css` and `dialog-accessibility.js` together. To roll back, restore the baseline frontend files and remove the new dialog script reference/file. Do not overwrite the independent pharmacology worktree or production data.
