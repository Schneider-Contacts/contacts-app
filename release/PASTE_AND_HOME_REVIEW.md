# Paste recovery and Home navigation review, 10 November 2026

Local follow-up to deployed baseline c54af75. Not deployed by this review.

## Roster copy/paste

The exact text received from the user fails the deployed parser: root metadata uses
directional smart quotes and the final `entries` property contains complete objects
without an array envelope. The same received payload now validates locally as 36
assignments across 30 dates, with source values preserved. This proves the received
text's failure and recovery, not where its formatting changed on the user's device.

- A bounded JSON grammar permits only paired smart quote delimiters and a missing
  array envelope around the final root `entries` object's complete sequence.
- Duplicate keys, ambiguous quotation, missing commas/braces, truncation, arbitrary
  prose, executable input, size/depth limits and invalid schema remain rejected.
- The preview explicitly lists formatting repairs and exposes canonical JSON without
  overwriting the original pasted input. Review, server validation and publication
  confirmation remain mandatory.
- No names, phones, dates, times or uncertainty flags are corrected by recovery.
  Import success is not verification of the roster's clinical/operational content.
- The prompt now asks for one JSON code block with ASCII delimiters and an entries
  array. The UI recommends its Copy button instead of selecting rich chat text.

## Search and Home

Live read-only reproduction confirmed that category → clear category → search →
clear could leave all contacts displayed with Home tools absent. Plain search →
clear already worked. Selection mode was another barrier to Home.

- Added an explicit, keyboard-accessible 44px Home button while viewing results.
- Home clears search/category/browse state and ends selection mode, while retaining
  chosen contacts for a clearly labeled Resume selection action.
- Explicit Finish selection still clears selections. Login/logout behavior is unchanged.
- Global search clearing resets stale browse state. Clearing text within an active
  category retains that deliberately chosen category.
- Home focuses the neutral directory heading and scrolls to the top. Browser history
  semantics were not changed.

## Verification

- All 19 Node regression scripts pass, including 35 parser tests, 11 import flow tests
  and expanded search/selection/Home coverage.
- 26 simulated DOM dialog checks pass.
- Native Safari: 56 combined checks and 76 dedicated search/Home checks pass across
  320, 375, 390, 430 and 960px fixture widths.
- Native Safari manual paste of a synthetic smart-quote/missing-array example yields
  the explicit repair notice, intact uncertainty, correct preview and disabled publish
  until review. Manual search → Home passes with heading focus.
- Two independent sets of 1,000 synthetic source-preservation cases pass. Additional
  punctuation deletion, malformed token and prototype cases remain rejected.
- Syntax, static audit, whitespace and protected owner signature checks pass.

Browser fixtures use synthetic contacts/rosters and stubbed backend/clipboard actions.
No physical phone test or real roster publication was performed. The actual private
payload remains outside this repository. Firestore rules, backend and access controls
are unchanged; no deployment or migration is needed beyond publishing website assets
together after approval.
