# Combined contacts release, 10 November 2026

Integrates UX correction commit 3846471 and pharmacology feature 9bb83d8 on deployed baseline 1b99b24. The original UX document and validation log describe the earlier standalone package; this note supersedes their remaining release-gate and pharmacology-exclusion statements.

## Integration

- Resolved shared frontend conflicts without dropping either change set.
- Added pharmacology to shared dialog dismissal and summary elements to keyboard navigation. Prevented the local roster handler from repeating an already-handled keyboard event.
- Updated all changed frontend cache keys together.
- Apps Script files/manifest, protected owner signature and logo assets remain unchanged.
- Added one isolated Firestore rule for reviewed monthly pharmacology rosters, with authorized single-month reads, existing-admin writes, and denied list/delete.

## Verification

- All 18 Node regression scripts pass, including 20 pharmacology parser cases and mocked UI service flows.
- 26 shared-dialog checks pass both in jsdom and native Safari.
- 39 combined native Safari checks pass at 320/375/390/430/960px iframe widths, including roster links, no inferred current on-call without hours, review gating, synthetic publish/cancel, close/reopen, Escape and Back/Forward.
- Full Rules API source compilation and 25 isolated authorization cases pass. Live rules were identical to the saved baseline before publication.
- JavaScript syntax, whitespace, unchanged backend/signature/assets checks pass.
- Live pre-release frontend matched baseline and Apps Script health returned OK.

## Scope and limitations

No real pharmacology roster was supplied or populated. No production contact, request, access, or roster records were changed. Browser fixtures use synthetic data and stubbed services. Mobile widths were checked in Safari, not on a physical phone. Production write/approval flows and mobile Contacts import were not exercised. Rules API tests used mocked data, not emulator or production Firestore writes.

## Rollback

Restore the previous frontend commit 1b99b24 through the normal repository workflow after checking for later changes. The preceding Firestore ruleset and exact source are preserved separately for an authorized rollback. Server deployment v49 is not changed. A code rollback does not undo legitimate user data changes.
