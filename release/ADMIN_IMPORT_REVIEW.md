# Admin import presentation review, 10 November 2026

Local follow-up to 79e43a6. No production data, permissions, backend, rules,
roster schema, parser, or deployment changes are part of this patch.

## Changes

- Admin → System now presents Interns in the same compact navigation-row style
  as Pharmacology. Current month/count, stale-list warning and access-boundary
  explanation remain in its management dialog. Restore moved into that dialog;
  it closes the dialog before entering the unchanged confirmation/restore flow.
- The review checkbox had inherited global `appearance: none` and text-field
  padding. It now uses an explicit 24px native checkbox, green check, a large
  tappable label, visible keyboard focus, checked border/background and textual
  “✓ הבדיקה סומנה” feedback. Existing review requirements remain unchanged.
- Successful roster publication closes the editor only after the transaction
  resolves, clears the draft, restores launcher focus and announces success in
  the main admin status. Cancel, conflict and service failure keep the editor
  open; failure retains the source and requires fresh preview/review. Pending
  publication still prevents dismissal and duplicate publication.
- Removed only the now-unused large-card styles and updated asset cache keys.

## Verification

- All 21 `tests/*.js` scripts pass, including new compact-card checks and
  expanded review, cancel, pending, failure, duplicate and success-close cases.
- All 26 simulated DOM dialog checks pass.
- Isolated Chrome checks pass at 320, 375, 390, 430 and 960px: consistent card
  dimensions, no horizontal overflow, existing-list details and restore cancel,
  invalid file/retry, synthetic Excel preview, touch and keyboard review,
  failure retention, success close, focus restoration, Forward and reopen.
- Existing pharmacology browser smoke suite passes at all five widths.
- Existing combined (56 checks), directory/Home and dialog (26 checks) browser
  regression pages pass in Chrome.
- Checked text/accent contrast is at least 4.5:1; unchecked boundary at least
  3:1. Synthetic 390px screenshots were visually inspected locally.
- Syntax, static audit, whitespace and protected owner signature checks pass.
  Intern publication and restore data-writing functions are byte-for-byte
  unchanged from the base commit.

All browser data and service calls were isolated synthetic fixtures. External
requests were blocked. No production publication or writes were performed.
This patch has not been validated on a physical iPhone or rerun in Safari.
The broader scrolling/Labs design and the two registration routes were reviewed
separately, with no implementation changes in this patch.
