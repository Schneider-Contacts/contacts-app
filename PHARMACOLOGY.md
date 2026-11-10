# Pharmacology on-call roster

This feature adds a compact home shortcut beside Interns and a monthly roster
publisher under Admin → System → Pharmacology.

## Monthly workflow

1. Open the admin roster dialog and expand the AI instructions.
2. Use the instructions with the monthly source image in an AI tool of your choice.
   This app does not upload the image, call an AI service, or store the image.
3. Paste the resulting JSON. The preview validates the complete document, shows
   all assignments, and identifies missing dates, unknown hours and uncertain data.
4. Compare every name, telephone number, date and shift with the original image.
   Correct the JSON and preview again whenever necessary. Editing invalidates review.
5. Check the review acknowledgment and confirm publication. This replaces only the
   selected month, atomically. A version conflict requires a fresh preview.

Draft text exists only in memory and is cleared when the dialog closes or the
session returns to login. Published rosters are stored in the protected Firestore
collection `pharmacologyRosters`, with `YYYY-MM` document IDs. No roster or personal
number belongs in this public source repository.

## Input contract

The root contains `schemaVersion: 1`, `month` (`2000-01` through `2099-12`),
`timeZone: "Asia/Jerusalem"`, optional `notes`, and 1–100 `entries`.
Each entry has `date` (`YYYY-MM-DD`, within the chosen month), `name`, `shift`, and
optional `phone`, `start`, `end`, `endNextDay`, `uncertain`, `note`.

- `start` and `end` must either both be empty/absent or both be `HH:mm`.
- Overnight shifts require explicit `endNextDay: true`. Never infer duty hours
  from laboratory operating hours or a label such as "morning".
- Unknown phone numbers stay empty. Uncertain entries use `uncertain: true`.
- Invalid dates, phone formats, types, duplicate assignments and timed overlaps
  block publication. Missing days and unknown times produce explicit warnings.
- The supplied AI prompt includes a fabricated example and extraction safeguards.

## Reader behavior

The app reads from the server, not an offline roster cache. Failure clears the
call links and shows a retry state. Opening/returning to the view and a visible
60-second refresh revalidate the schedule. Links older than a minute are blocked
until refresh. Logout clears the view; late responses cannot revive it.

Assignments are displayed as written. Known people with unknown times retain
clearly named call links, but no "current on call" label is inferred. Uncertain
entries have no call link. An explicit, unique time interval may be highlighted
as current according to the roster. Previous-day overnight carryover includes
its actual starting date. Month-boundary carryover reads the previous month only
when needed; an old month is never substituted for a missing current roster.

## Access and deployment

Existing `isAllowed()` and `isAdmin()` policies remain unchanged. Only existing
administrators may write reviewed month documents; only authorized users/admins
may fetch a month. Listing and deletion are denied. Rules validate the document
envelope and bounds; the client validates individual entries again on every read.

Deployment requires review of both the static site and the added Firestore rule.
Publish rules before the UI to prevent a permission-denied reader state. This
feature needs no Apps Script changes; the current server deployment stays intact.
Do not populate production with real data until the source has been reviewed and
publication is authorized.

## Verification

Run `for f in tests/*.js; do node "$f" || exit 1; done` for the full regression
suite. New parser tests cover Israel dates/DST, midnight, overnight, month/year
rollover, overlaps, uncertainty, schema bounds and prompt content. New UI tests
cover authenticated server reads, failures, stale responses, logout, draft review,
cancel/publish, concurrency and account changes. Static audits include both scripts.

`qa/pharmacology-browser.js` uses Playwright with all network requests intercepted
and synthetic in-memory Firestore. It checks 320, 375, 390, 430 and 960px viewports,
call links without guessed current status, home navigation, explicit review,
confirmation stacking, cancel/publish, close/reopen and Escape. Set
`PLAYWRIGHT_MODULE` and `CHROME_EXECUTABLE` for an existing external installation.
Optional `QA_SCREENSHOT_DIR` saves synthetic screenshots locally only.

The combined release was checked in native Safari with isolated synthetic fixtures
at 320, 375, 390, 430 and 960px widths. Shared dialog handling covers the roster
editor, including Escape, Back/Forward and the AI-instructions summary.

The development Mac has no Java runtime, so Firestore emulator tests were not run.
Instead, the Firebase Rules API compiled the complete candidate and passed 25
isolated authorization tests using synthetic mocked identities and documents.
These cover allowed/admin reads, revoked/unauthenticated denial, list/delete denial,
non-admin write denial, valid admin create/update, and invalid envelope/publisher/
server-timestamp cases. They do not substitute for production write round-trips.
No real roster data or production test writes were made.
