# Focused signup clarity review, 10 November 2026

Base: f541c5b0e6b561cbd1bf27cd9545cafd91ba70e4. Local branch:
`fix/signup-clarity-20261110`. No push or deployment was performed.

## Scope

- Kept the existing email → phone order and automatic choice between the two
  signup routes. The phone screen explains both in two short paragraphs.
- A matched directory person sees “הפרטים שלכם כבר בספר” and proceeds directly
  to password setup. No repeat personal-details form or extra screen was added.
- A new person sees the same brief required-details form, with shorter copy and
  a clear “המשך לבחירת סיסמה” button. The existing 24-hour temporary-access and
  permanent manager-approval conditions are disclosed at password setup for
  both provisional signup paths, without repeating them on every screen.
- A truly missing local session during email verification returns to password
  login for the same email. Old password fields and stale success state are
  cleared. This never claims the email is verified; the normal login and
  authorization checks still decide access. Network/initialization failures do
  not get labeled as session expiry.
- Verification checks now suppress overlapping clicks/return events and ignore
  results from an old account or abandoned flow. A deliberate access denial
  keeps its accurate reason on subsequent return events rather than being
  rewritten as a session-expiry error.
- Fixed the signup-only Back control being visible on ordinary login because
  its display style overrode the HTML hidden attribute. Updated asset keys.

## Verification

- All 22 `tests/*.js` scripts pass, including 54 focused verification-session
  checks and the existing server-side registration/approval/security fixtures.
- All 26 simulated DOM dialog regressions pass.
- Isolated headless Chrome signup checks pass at 320, 375, 390, 430 and 960px:
  150 checks across both full signup branches, required fields, token-bound
  finalization, verification, offline retry, missing-session login, same-email
  preservation, reauthentication, reset copy, Back and layout overflow.
- Existing browser fixture regressions pass: combined 56, directory/Home 76,
  and dialogs 26 checks. All remote requests were blocked in browser fixtures.
- Synthetic 390px screenshots of email, phone, both signup branches and missing-
  session recovery were visually inspected. No production records were used.
- Syntax, whitespace, protected owner-signature comparison and unchanged
  backend/Firestore-rule comparisons pass.
- Independent read-only review completed with no remaining actionable findings.
  Its access-denial feedback was fixed and regression-tested.

No Firebase production-account creation, real email send, Firestore write,
permission change, Apps Script change, or deployment was performed. These are
synthetic service tests, not a live Firebase integration or physical-iPhone test.
Safari signup testing was not performed. No persistent personal-data fields
were added.

## Release handoff

The patch is frontend-only. Review/integrate the local commit, rerun affected
checks against the integrated tree, and publish only under the parent's release
authorization. The independent compact Home-button patch is not included here.
