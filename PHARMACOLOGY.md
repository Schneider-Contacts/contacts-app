# Pharmacology on-call roster

This feature adds a compact home shortcut beside Interns and a monthly roster
publisher under Admin → System → Pharmacology.

## Monthly workflow

1. Open the admin roster dialog and press **העתקת הוראות לצ׳אט**. The button
   copies instructions only; it does not open a chat, send data, or upload an image.
2. Paste the instructions into the AI chat of your choice and attach the source
   image yourself. The prompt requests one JSON object in a single JSON code block,
   without surrounding commentary. Use that block's Copy button rather than selecting
   formatted chat prose. Review the generated contents against the image.
3. Paste the JSON, or optionally choose a UTF-8 `.json`/`.txt` file up to 100KB.
   Files are read locally; selecting a file never publishes it. Image/Excel imports
   are not supported here. A BOM or one complete JSON code fence is accepted.
   Recognized quote-delimiter corruption and a missing final `entries` array envelope
   are recovered only when the complete structure is unambiguous and still passes the
   strict schema. The preview lists those formatting repairs and shows the canonical
   JSON without overwriting the pasted text. No names, phones, times or uncertainty
   flags are corrected by this process. Truncation, duplicate keys, arbitrary prose,
   ambiguous structure and invalid data still fail.
4. Press preview (automatic after file selection). The local preview appears before
   the server check and summarizes call-enabled rows, missing hours and uncertainty.
   Detailed warnings are collapsed. Publishing stays disabled until the server
   check succeeds and you mark the review acknowledgment.
5. Compare every name, telephone number, date and shift with the original image.
   Correct the JSON and preview again whenever necessary. Editing invalidates review.
6. Confirm publication. This replaces only the selected month, atomically. A
   version conflict or uncertain write outcome requires a fresh preview.

Clipboard API failures use a legacy copy attempt, then reveal and select the
instructions for manual copy if needed. The app never claims copy succeeded when
both attempts fail. Closing/reopening the editor prevents stale file reads or
clipboard failures from altering the new draft.

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
- Overnight intervals require `endNextDay: true`. The prompt permits normalization
  of an unambiguous printed range such as 21–8 to an overnight interval, retaining
  the printed range in the note. Ambiguous ranges retain empty times and an explicit
  uncertainty note. Never infer hours from laboratory hours or a shift label.
- Unknown phone numbers and hours stay empty. Missing fields alone do not mean the
  known identity is uncertain. Use `uncertain: true` for genuine transcription or
  assignment ambiguity; this hides the call button. The review checkbox never
  clears uncertainty. A bare name under an on-call roster heading may be categorized
  as on-call, with the source noted, without marking it uncertain merely for that reason.
- Invalid dates, phone formats, types, duplicate assignments and timed overlaps
  block publication. Missing days and unknown times produce explicit warnings.
- The supplied AI prompt includes a fabricated example and extraction safeguards.
  It asks for empty notes when there is no special caveat, avoiding repeated warnings
  that hours are absent; the app already summarizes this condition.

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
rollover, overlaps, uncertainty, schema bounds and prompt content. New import tests cover clipboard success/fallback, local file selection, invalid
files, stale reads, server-error classification and fail-closed publication gating.
UI tests cover authenticated server reads, failures, stale responses, logout, draft review,
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
